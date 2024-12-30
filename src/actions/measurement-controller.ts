import {
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";
import { MeasurementSettings } from "../models/MeasurementSettings";
import { ILogger } from "../helpers/logger/ILogger";
import { IpcService } from "../services/IpcService";
import { MeasurementTimerManager } from "../services/MeasurementTimerManager";
import { IMeasurementTypesProvider } from "../providers/measurement-types/IMeasurementTypesProvider";
import { IIpcProviderFactory } from "../providers/ipc/IIpcProviderFactory";
import {AfterburnerMeasurement} from "../models/AfterburnerMeasurement";
import {MeasurementType} from "../models/MeasurementType";

type MessagePacket = {
	messageType: string;
	payload: any;
}

@action({ UUID: "wsh.afterburner-viewer.measurement" })
export class MeasurementController extends SingletonAction<MeasurementSettings> {

	private readonly ipcService: IpcService;
	private readonly timerManager: MeasurementTimerManager;

	constructor(
		ipcFactory: IIpcProviderFactory,
		private readonly measurementTypesProvider: IMeasurementTypesProvider,
		private readonly logger: ILogger
	) {
		super();

		this.timerManager = new MeasurementTimerManager(
			measurementTypesProvider,
			logger
		);

		this.ipcService = new IpcService(ipcFactory, this.timerManager);
		this.ipcService.onDataReceived.subscribe((jsonData) => {
			this.handlePacket(jsonData);
		});
	}

	protected handlePacket(jsonData: string) {
		const mp = JSON.parse(jsonData) as MessagePacket;
		const isTypesPacket = () => mp.messageType === 'MeasurementTypes';
		const handleTypesPacket = () => {
			const names = (mp.payload as MeasurementType[])
				.map((mt) => mt.Name);
			this.measurementTypesProvider.setTypes(names);
		}
		const handleMeasurementsPacket = () => {
			this.timerManager.data = JSON.stringify(
				mp.payload as AfterburnerMeasurement[]);
		}

		try {
			if (isTypesPacket())
				handleTypesPacket();
			else
				handleMeasurementsPacket();
		} catch (e) {
			this.logger.error(`Error in handlePacket: ${e}`);
		}
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

		if (!this.isSettingsValid(settings)) {
			this.initializeSettings(settings);
		}

		this.ipcService.restartIpcTimer();

		settings.enabled = true;
		this.timerManager.restartMeasurementTimer(settings, ev);
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
			if (!this.isSettingsValid(settings)) {
				this.initializeSettings(settings);
			}
			this.timerManager.setNextMeasurementForTimer(settings);
			await ev.action.setSettings(settings);
		} catch (e) {
			this.logger.error(`Error in onKeyDown: ${e}`);
		}
	}

	protected initializeSettings(settings: MeasurementSettings): void {
		settings.enabled = false;
		settings.timer = null;
		settings.measurementType = this.measurementTypesProvider.getDefault();
	}

	protected isSettingsValid(settings: MeasurementSettings): boolean {
		return typeof settings.enabled !== 'undefined' && settings.enabled !== null;
	}
}
