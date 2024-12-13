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
import type {ActionEvent} from "@elgato/streamdeck/types/common/events";


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
			}

			settings.enabled = !settings.enabled;

			this.restartMeasurementTimer(settings, ev);

			await ev.action.setSettings(settings);

		} catch (e) {
			streamDeck.logger.error(`Error in onKeyDown:`);
			streamDeck.logger.error(e);
		}
	}

	private restartMeasurementTimer(settings: CounterSettings, ev: ActionEvent<CounterSettings>) {
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
	}

	private createTimer(ev1: ActionEvent<CounterSettings>) : string {
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

					await ev.action.setImage(`data:image/svg+xml,${encodeURIComponent(this.getSVG(measurement))}`);
				}
			}, 500));

		return uniqueId;
	}

	private getSVG(measurement: AfterburnerMeasurement) {
		const valStr: string = (measurement.Type.Format)
			? measurement.Value.toFixed(3)
			: Math.round(measurement.Value).toFixed();

		const bar = {
			x: 30, y: 45,
			w: 0, h: 0,
		}
		bar.w = 100 - (bar.x * 2);
		bar.h = 100 - bar.y;
		const level = this.getLevel(measurement);
		const strokeWidth = 0.618;
		return `<svg width="100" height="100">
					<defs>
						<!-- BAR GRADIENT -->
						<linearGradient id="gradient" x1="0%" y1="100%" x2="0%" y2="0%">
							<stop offset="34%" stop-color="green" />
							<stop offset="61.8%" stop-color="orange" />
							<stop offset="100%" stop-color="darkred" />
						</linearGradient>
						
						<!-- BAR BORDER MASK -->
						<mask id="border-bg">
							<!-- Fill everything -->
							<rect x="0" y="0" width="100%" height="100%" fill="white" />
							<!-- Cut out the rect for border -->
							<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="black" />
						</mask>
						
						<!-- BAR CUTOUT REMAINING MASK -->
						<mask id="bar-cutout-remaining">
							<!-- Fill everything -->
							<rect x="0" y="0" width="100%" height="100%" fill="white" />
							<!-- Cut out remianing part of the bar -->
							<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h - (level * bar.h)}" fill="black" />
						</mask>
					</defs>
					
					<!-- Clear all -->
					<rect x="0" y="0" width="100%" height="100%" fill="black" />
					
					<!-- BAR BORDER - outer stroke -->
					<rect fill="none" stroke="lightgray" 
						mask="url(#border-bg)"
						stroke-width="${strokeWidth}" 
						x="${bar.x - strokeWidth / 2}"
						y="${bar.y - strokeWidth / 2}" 
						width="${bar.w + strokeWidth}" 
						height="${bar.h + strokeWidth}" 
					/>
					
					<!-- BAR - fill 100% -->
					<rect 
						fill="url(#gradient)"
						mask="url(#bar-cutout-remaining)"
						x="${bar.x}" 
						y="${bar.y}"
						width="${bar.w}" 
						height="${bar.h}"
					/>
						
					<!-- TYPE -->
					<text x="50" y="15"
						text-anchor="middle"
						font-size="10" 
						fill="lightgray"
					>
						${measurement.Type.Name}
					</text>
					
					<!-- VALUE and UNIT -->
					<text x="56" y="35"
						text-anchor="middle"
						font-size="19" 
						fill="white"
						font-weight="bold"
					>
						${valStr}<tspan font-size="8" font-weight="lighter" fill="lightgray" alignment-baseline="middle">${measurement.Type.Unit}</tspan>
					</text>
				</svg>`;
	}

	protected getLevel(measurement: AfterburnerMeasurement) : number {
		if (   measurement.Type.Max === 0
			|| measurement.Type.Max <= measurement.Type.Min) {
			return 0;
		}

		return Math.min(1.0, Math.max(0.0,
			(measurement.Value - measurement.Type.Min) / (measurement.Type.Max - measurement.Type.Min)));
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
