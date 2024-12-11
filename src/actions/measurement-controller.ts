import {
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	streamDeck,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";
import {randomUUID} from 'crypto';
import {IpcClient} from "./IpcClient";


/*
    public record MeasurementType
    {
        public required string Name { get; init; }
        public required string Unit { get; init; }
        public required double Min { get; init; }
        public required double Max { get; init; }
        public required int Base { get; init; }
        public required string? Format { get; init; }
    }

    public record AfterburnerMeasurement
    {
        public required MeasurementType Type { get; init; }
        public required double Value { get; init; }
    }
* */

class MeasurementType {
	public Name: string = '';
	public Unit: string = '';
	public Min: number = 0;
	public Max: number = 0;
	public Base: number = 0;
	public Format: string | null = null;
}

class AfterburnerMeasurement {
	public Type: MeasurementType = new MeasurementType();
	public Value: number = 0;
}

@action({ UUID: "wsh.afterburner-viewer.measurement" })
export class MeasurementController extends SingletonAction<CounterSettings> {
	
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

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<CounterSettings>): void | Promise<void> {
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

	override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		if (!MeasurementController.isSettingsValid(settings)) {
			MeasurementController.initializeSettings(settings);
			ev.action.setSettings(settings);
		}

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
			setInterval(async () => {
				if (this.data) {
					const type : string = this.getTypeForTimer(uniqueId);
					streamDeck.logger.info(`[LOOP] TYPE = ${type}`);
					streamDeck.logger.info(`[LOOP] DATA = ${this.data}`);

					const measurements = JSON.parse(this.data) as AfterburnerMeasurement[];

					const measurement = measurements.find((m: any) => m.Type.Name === type);
					if (measurement === undefined || measurement === null) {
						streamDeck.logger.error(`Measurement not found for type: ${type}`);
						return;
					}

					const valStr : string = (measurement.Type.Format)
						? measurement.Value.toFixed(3)
						: Math.round(measurement.Value).toFixed();

					// await ev.action.setTitle(`${type}\n${valStr}\n${measurement.Type.Unit}`);
					await ev.action.setTitle(``);

					const colors: { bg: string; text: string; textBorder: string } = this.getLevelAsColors(measurement);
					const svg = `<svg width="100" height="100">
						<circle fill="${colors.bg}" r="45" cx="50" cy="50" ></circle>
						<text x="50" y="30"
							text-anchor="middle"
							font-size="10" 
							fill="${colors.text}"
							stroke="${colors.textBorder}" stroke-width="3"
						>
							${type}
						</text>
						<text x="50" y="60"
							text-anchor="middle"
							font-size="18" 
							fill="${colors.text}"
							stroke="${colors.textBorder}" stroke-width="5"
						>
							${valStr} ${measurement.Type.Unit}
						</text>
					</svg>`;
					await ev.action.setImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
				}
			}, 500));
		return uniqueId;
	}

	private getLevelAsColors(measurement: AfterburnerMeasurement) {
		const level = getLevel();

		if (level > 0.9) {
			return {
				bg: '#FF0000',
				text: '#000000',
				textBorder: '#000000'
			};
		} else if (level > 0.8) {
			return {
				bg: '#FF4500',
				text: '#000000',
				textBorder: '#000000'
			};
		} else if (level > 0.7) {
			return {
				bg: '#FFA500',
				text: '#001B55',
				textBorder: '#000000'
			}
		} else if (level > 0.6) {
			return {
				bg: '#FFD700',
				text: '#001b55',
				textBorder: '#000000'
			}
		} else if (level > 0.5) {
			return {
				bg: '#FFFF00',
				text: '#001b55',
				textBorder: '#000000'
			}
		} else if (level > 0.4) {
			return {
				bg: '#ADFF2F',
				text: '#000000',
				textBorder: '#ffffff'
			}
		} else if (level > 0.3) {
			return {
				bg: '#32CD32',
				text: '#ffd800',
				textBorder: '#ffffff'
			}
		} else if (level > 0.2) {
			return {
				bg: '#008000',
				text: '#ffd800',
				textBorder: '#ffffff'
			}
		} else if (level > 0.1) {
			return {
				bg: '#006400',
				text: '#ffd800',
				textBorder: '#ffffff'
			}
		} else {
			return {
				bg: '#004200',
				text: '#ffd800',
				textBorder: '#ffffff'
			}
		}

		function getLevel() {
			return (measurement.Value - measurement.Type.Min) / (measurement.Type.Max - measurement.Type.Min);
		}
	}

	protected getTypeForTimer(timerUID: string) : string {
		return this.timerMeasurementTypes.get(timerUID) || '';
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
	measurementType?: string;
};
