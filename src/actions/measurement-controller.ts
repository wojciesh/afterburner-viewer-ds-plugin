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
import { MeasurementSettings } from "../models/MeasurementSettings";
import { ILogger } from "../helpers/logger/ILogger";
import { StreamDeckLogger } from "../helpers/logger/StreamDeckLogger";
import { IpcService } from "../services/IpcService";
import { MeasurementTimerManager } from "./MeasurementTimerManager";

@action({ UUID: "wsh.afterburner-viewer.measurement" })
export class MeasurementController extends SingletonAction<MeasurementSettings> {
	private readonly ipcService: IpcService;
	private readonly timerManager: MeasurementTimerManager;
	private readonly ext: any = {};
	public logger: ILogger = new StreamDeckLogger();

	private get data(): string {
		return this.ext.data || '';
	}
	private set data(value: string) {
		this.ext.data = value;
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

	constructor() {
		super();
		this.ipcService = new IpcService();
		this.timerManager = new MeasurementTimerManager(this.logger, () => this.data);

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
			this.timerManager.setMeasurementTypeForTimer(settings.timer, settings.measurementType);
		}
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
		this.timerManager.killTimer(settings.timer);
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

	private setNextMeasurementForTimer(settings: MeasurementSettings): void {
		const idx = MeasurementController.allMeasurementTypes.indexOf(settings.measurementType);
		settings.measurementType =
			MeasurementController.allMeasurementTypes[(idx + 1) % MeasurementController.allMeasurementTypes.length];

		if (settings.timer != null) {
			this.timerManager.setMeasurementTypeForTimer(settings.timer, settings.measurementType);
		}
	}

	private restartMeasurementTimer(settings: MeasurementSettings, ev: any): void {
		settings.measurementType = settings.timer
			? this.timerManager.getMeasurementTypeForTimer(settings.timer)
			: MeasurementController.allMeasurementTypes[0];

		this.timerManager.killTimer(settings.timer);

		if (settings.enabled) {
			this.logger.debug("Starting timer...");
			try {
				settings.timer = this.timerManager.createTimer(ev.action, settings.measurementType);
			} catch (e) {
				this.logger.error(`Error starting timer: ${e}`);
			}
		}
	}

	protected static initializeSettings(settings: MeasurementSettings): void {
		settings.enabled = false;
		settings.timer = null;
		settings.measurementType = MeasurementController.allMeasurementTypes[0];
	}

	protected static isSettingsValid(settings: MeasurementSettings): boolean {
		return typeof settings.enabled !== 'undefined' && settings.enabled !== null;
	}
}
