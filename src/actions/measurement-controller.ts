import { streamDeck, action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { randomUUID } from 'crypto';
import { IpcClient } from "./IpcClient";


@action({ UUID: "wsh.afterburner-viewer.measurement" })
export class MeasurementController extends SingletonAction<CounterSettings> {
	
	protected readonly IPC_PIPE_NAME = 'ab2sd-1';
	
	protected ipcClient: IpcClient | null = null;
	protected isIpcInitialized: boolean = false;
	
	protected readonly timers = new Map<string, NodeJS.Timeout>();
	protected ipcTimer: NodeJS.Timeout | null = null;
	
	private get data(): string {
		return this.ext.data || '';
	}
	private set data(value: string) {
		this.ext.data = value;
	}
	private get type(): string {
		return this.ext.type || '';
	}
	private set type(value: string) {
		this.ext.type = value;
	}
	private readonly ext: any = {};

	public isIpcServerRunning: boolean = false;
	
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

	override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		if (!MeasurementController.isSettingsValid(settings)) {
			MeasurementController.initializeSettings(settings);
			ev.action.setSettings(settings);
		}

		if (this.ipcTimer) 
			clearInterval(this.ipcTimer);

		this.ipcTimer = setInterval(() => {

			if (this.isIpcServerRunning) { 
				streamDeck.logger.info("IPC LOOP: server running");
				
				if (this.timers.size > 0) {
					streamDeck.logger.info("IPC LOOP: timers size > 0: " + this.timers.size);

					if (!this.isIpcConnected()) {
						streamDeck.logger.info("IPC LOOP: not connected, will connect!");
						this.ipcConnect();
					} else {
						streamDeck.logger.info("IPC LOOP: already connected, skipping connect");
					}
					return;

				} else {
					streamDeck.logger.info("IPC LOOP: no timers, disconnecting IPC");
				}
			} else {
				streamDeck.logger.info("IPC LOOP: server not running, disconnecting IPC");
			}

			this.ipcClose();

			streamDeck.logger.info("IPC LOOP: IPC closed");

		}, 500);

		return ev.action.setTitle(`I: ${settings.enabled ? 'ON' : 'OFF'}`);
	}

	override onWillDisappear(ev: WillDisappearEvent<CounterSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		this.killTimer(settings);
		this.ipcClose();
	}
	
	override async onKeyDown(ev: KeyDownEvent<CounterSettings>): Promise<void> {
		try {
			const { settings } = ev.payload;
			if (!MeasurementController.isSettingsValid(settings)) {
				MeasurementController.initializeSettings(settings);
				ev.action.setSettings(settings);
			}

			settings.enabled = !settings.enabled;

			this.killTimer(settings);

			if (settings.enabled) {
				streamDeck.logger.debug("KD STARTING TIMER");

				try {
					settings.timer = this.createTimer(ev);
				} catch (e) {
					streamDeck.logger.error(`Error starting timer:`);
					streamDeck.logger.error(e);
				}
			}

			await ev.action.setSettings(settings);
			await ev.action.setTitle(`KD: ${settings.enabled ? 'ON' : 'OFF'}`);

		} catch (e) {
			streamDeck.logger.error(`Error in onKeyDown:`);
			streamDeck.logger.error(e);
		}
	}

	private createTimer(ev1: KeyDownEvent<CounterSettings>) : string {
		const ev = ev1;
		const uniqueId = randomUUID();
		this.timers.set(uniqueId,
			setInterval(() => {
				if (this.data) {
					// streamDeck.logger.info(`LOOP ENABLED: ${settings.enabled}`);
					// streamDeck.logger.info(`LOOP TIMER: ${settings.timer}`);
					// streamDeck.logger.info(`LOOP TYPE: ${this.type}`);
					streamDeck.logger.info(`LOOP DATA: ${this.data}`);

					// ev.action.setTitle(`L: ${settings.enabled ? 'ON' : 'OFF'}`);
					ev.action.setTitle(`L:${this.data}`);
				}
			}, 1000));
		return uniqueId;
	}

	private killTimer(settings: CounterSettings) {
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

	protected static initializeSettings(settings: CounterSettings) {
		settings.enabled = false;
		settings.timer = null;
	}

	protected static isSettingsValid(settings: CounterSettings) {
		return typeof settings.enabled !== 'undefined' && settings.enabled !== null;
	}

}

/**
 * Settings for {@link MeasurementController}.
 */
type CounterSettings = {
	enabled?: boolean;
	timer?: any;
};
