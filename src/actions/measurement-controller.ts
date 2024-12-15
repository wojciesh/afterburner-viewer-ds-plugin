import {
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	streamDeck,
	WillAppearEvent,
	WillDisappearEvent,
	ApplicationDidLaunchEvent,
	ApplicationDidTerminateEvent
} from "@elgato/streamdeck";
import {randomUUID} from 'crypto';
import {IpcClient} from "./IpcClient";

import { AfterburnerMeasurement } from "../models/AfterburnerMeasurement";
import { MeasurementSettings } from "../models/MeasurementSettings";
import {SvgRenderer} from "../helpers/SvgRenderer";

@action({ UUID: "wsh.afterburner-viewer.measurement" })
export class MeasurementController extends SingletonAction<MeasurementSettings> {
	
	protected readonly IPC_PIPE_NAME = 'ab2sd-1';
	
	protected ipcClient: IpcClient | null = null;
	protected isIpcInitialized: boolean = false;
	
	protected readonly timers = new Map<string, NodeJS.Timeout>();	// <timerUID, timer>
	protected readonly timerMeasurementTypes = new Map<string, string>();	// <timerUID, measurementType>
	protected ipcTimer: NodeJS.Timeout | null = null;
	
	private get data(): string {
		return this.ext.data || '';
	}
	private set data(value: string) {
		this.ext.data = value;
	}
	private readonly ext: any = {};

	private isIpcServerRunning: boolean = false;

	constructor() {
		super();
		streamDeck.system.onApplicationDidLaunch((ev: ApplicationDidLaunchEvent) => {
			streamDeck.logger.info(`Launched: ${ev.application}`);
			this.isIpcServerRunning = true;
		});
		streamDeck.system.onApplicationDidTerminate((ev: ApplicationDidTerminateEvent) => {
			streamDeck.logger.info(`Terminated: ${ev.application}`);
			this.isIpcServerRunning = false;
		});
	}

	protected isIpcConnected() : boolean {
		return this.ipcClient?.isConnected() ?? false;
	}

	protected ipcConnect() {
		if (!this.isIpcInitialized) {
			
			this.ipcClient = new IpcClient();

			this.ipcClient.onDataReceived.subscribe((data) => {
				streamDeck.logger.info(`Data received: ${data}`);
				this.data = data.toString();
			});
			
			this.ipcClient.onConnectionOpened.subscribe(() => {
				streamDeck.logger.info("Connection opened!");
			});
			
			this.ipcClient.onConnectionClosed.subscribe(() => {
				streamDeck.logger.info("Connection closed!");
			});

			this.isIpcInitialized = true;
		}

		this.ipcClient?.ipcConnect(this.IPC_PIPE_NAME);
	}

	protected ipcClose() {
		if (this.ipcClient !== null) {
			this.ipcClient.ipcClose();
			this.ipcClient = null;
			this.isIpcInitialized = false;
		}
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<MeasurementSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		
		streamDeck.logger.info(`Settings received: ${JSON.stringify(settings)}`);

		if (settings.measurementType 
			&& settings.measurementType != '' 
			&& settings.timer
		) {
			this.setMeasurementTypeForTimer(settings.timer, settings.measurementType);
		}
	}

	private setMeasurementTypeForTimer(timerUID: string, measurementType: string) {
		this.timerMeasurementTypes.set(timerUID, measurementType);
	}

	private getMeasurementTypeForTimer(timerUID: string) : string {
		return this.timerMeasurementTypes.get(timerUID) || MeasurementController.allMeasurementTypes[0];
	}

	override onWillAppear(ev: WillAppearEvent<MeasurementSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		if (!MeasurementController.isSettingsValid(settings)) {
			MeasurementController.initializeSettings(settings);
		}

		this.restartIpcTimer();

		settings.enabled = true;

		this.restartMeasurementTimer(settings, ev);

		return ev.action.setSettings(settings);
	}

	private restartIpcTimer() {
		if (this.ipcTimer)
			clearInterval(this.ipcTimer);

		this.ipcTimer = setInterval(() => {

			if (this.isIpcServerRunning
				&& this.timers.size > 0
			) {
				if (!this.isIpcConnected()) {
					this.ipcConnect();
				}
			} else {
				this.ipcClose();
			}

		}, 250);
	}

	override onWillDisappear(ev: WillDisappearEvent<MeasurementSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		this.killTimer(settings);
		this.ipcClose();
	}
	
	override async onKeyDown(ev: KeyDownEvent<MeasurementSettings>): Promise<void> {
		try {
			const { settings } = ev.payload;
			if (!MeasurementController.isSettingsValid(settings)) {
				MeasurementController.initializeSettings(settings);
			}

			this.setNextMeasurementForTimer(settings);

			this.restartMeasurementTimer(settings, ev);

			await ev.action.setSettings(settings);

		} catch (e) {
			streamDeck.logger.error(`Error in onKeyDown:`);
			streamDeck.logger.error(e);
		}
	}

	private setNextMeasurementForTimer(settings: MeasurementSettings) {
		const idx = MeasurementController.allMeasurementTypes.indexOf(settings.measurementType);
		settings.measurementType = MeasurementController.allMeasurementTypes[(idx + 1) % MeasurementController.allMeasurementTypes.length];
		if (settings.timer != null) {
			this.setMeasurementTypeForTimer(settings.timer, settings.measurementType);
		}
	}

	public static allMeasurementTypes = [
		'Power',
		'CPU usage',
		'CPU clock',
		'CPU power',
		'Core clock',
		'RAM usage',
		'Memory usage',
		'Memory clock',
		'Commit charge',
		'GPU temperature',
		'GPU usage',
		'Fan speed',
		'Fan tachometer',
		'FB usage',
	];

	private restartMeasurementTimer(settings: MeasurementSettings, ev: any) {
		settings.measurementType = typeof settings.timer === "string"
			? this.getMeasurementTypeForTimer(settings.timer)
			: MeasurementController.allMeasurementTypes[0];

		this.killTimer(settings);

		if (settings.enabled) {
			streamDeck.logger.debug("KD STARTING TIMER");

			try {
				settings.timer = this.createTimer(ev);
				this.setMeasurementTypeForTimer(settings.timer, settings.measurementType);

			} catch (e) {
				streamDeck.logger.error(`Error starting timer:`);
				streamDeck.logger.error(e);
			}
		}
	}

	private createTimer(ev1: any) : string {
		const ev = ev1;
		const uniqueId = randomUUID();

		this.timers.set(uniqueId,
			setInterval(async () => {
				if (this.data) {
					await ev.action.setTitle(``);

					const type : string = this.getTypeForTimer(uniqueId);
					const measurements = JSON.parse(this.data) as AfterburnerMeasurement[];
					const measurement = measurements.find((m: any) => m.Type.Name === type);
					if (measurement === undefined || measurement === null) {
						streamDeck.logger.error(`Measurement not found for type: ${type}`);
						return;
					}

					await ev.action.setImage(`data:image/svg+xml,${encodeURIComponent(SvgRenderer.render(measurement))}`);
				}
			}, 500));

		return uniqueId;
	}

	protected getTypeForTimer(timerUID: string) : string {
		return this.timerMeasurementTypes.get(timerUID) || '';
	}

	private killTimer(settings: MeasurementSettings) {
		if (typeof settings.timer !== 'undefined' && settings.timer !== null) {
			streamDeck.logger.debug("KILLING TIMER: " + settings.timer);

			if (this.timers.has(settings.timer)) {
				const timer = this.timers.get(settings.timer);
				clearInterval(timer);
				this.timers.delete(settings.timer);
				settings.timer = null;
				streamDeck.logger.debug("OK, TIMER CLEARED");
			} else {
				streamDeck.logger.error("TIMER NOT FOUND IN MAP");
			}
		}
	}

	protected static initializeSettings(settings: MeasurementSettings) {
		settings.enabled = false;
		settings.timer = null;
		settings.measurementType = MeasurementController.allMeasurementTypes[0];
	}

	protected static isSettingsValid(settings: MeasurementSettings) {
		return typeof settings.enabled !== 'undefined' && settings.enabled !== null;
	}

}

