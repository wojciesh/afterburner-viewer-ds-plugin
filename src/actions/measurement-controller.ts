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

import { AfterburnerMeasurement } from "../models/AfterburnerMeasurement";
import { MeasurementSettings } from "../models/MeasurementSettings";
import {SvgRenderer} from "../helpers/SvgRenderer";
import {ILogger} from "../helpers/logger/ILogger";
import {StreamDeckLogger} from "../helpers/logger/StreamDeckLogger";
import {IpcService} from "../services/IpcService";

@action({ UUID: "wsh.afterburner-viewer.measurement" })
export class MeasurementController extends SingletonAction<MeasurementSettings> {
	
	protected readonly ipcService: IpcService;

	protected readonly timers = new Map<string, NodeJS.Timeout>();	// <timerUID, timer>
	protected readonly timerMeasurementTypes = new Map<string, string>();	// <timerUID, measurementType>

	
	private get data(): string {
		return this.ext.data || '';
	}
	private set data(value: string) {
		this.ext.data = value;
	}
	private readonly ext: any = {};

	public logger: ILogger = new StreamDeckLogger();


	constructor() {
		super();
		this.ipcService = new IpcService();
		this.ipcService.onDataReceived.subscribe((data) => {
			this.logger.info(`Data received: ${data}`);
			this.data = data;
		});
	}


	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<MeasurementSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		
		this.logger.info(`Settings received: ${JSON.stringify(settings)}`);

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

		this.ipcService.restartIpcTimer();

		settings.enabled = true;

		this.restartMeasurementTimer(settings, ev);

		return ev.action.setSettings(settings);
	}


	override onWillDisappear(ev: WillDisappearEvent<MeasurementSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		this.killTimer(settings);
		this.ipcService.ipcClose();
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
			this.logger.error(`Error in onKeyDown: ${e}`);
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
			this.logger.debug("KD STARTING TIMER");

			try {
				settings.timer = this.createTimer(ev);
				this.setMeasurementTypeForTimer(settings.timer, settings.measurementType);

			} catch (e) {
				this.logger.error(`Error starting timer: ${e}`);
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
						this.logger.error(`Measurement not found for type: ${type}`);
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
			this.logger.debug("KILLING TIMER: " + settings.timer);

			if (this.timers.has(settings.timer)) {
				const timer = this.timers.get(settings.timer);
				clearInterval(timer);
				this.timers.delete(settings.timer);
				settings.timer = null;
				this.logger.debug("OK, TIMER CLEARED");
			} else {
				this.logger.error("TIMER NOT FOUND IN MAP");
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

