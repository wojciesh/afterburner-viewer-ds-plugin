import { streamDeck, action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { randomUUID } from 'crypto';
import net from "net";

const PIPE_PATH = "\\\\.\\pipe\\ab2sd2";

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
*/
@action({ UUID: "wsh.afterburner-viewer.increment" })
export class IncrementCounter extends SingletonAction<CounterSettings> {
	
	timers = new Map<string, NodeJS.Timeout>();
	
	get data(): string {
		return this.ext.data || '';
	}
	set data(value: string) {
		this.ext.data = value;
	}
	get type(): string {
		return this.ext.type || '';
	}
	set type(value: string) {
		this.ext.type = value;
	}
	ext: any = {};


	client: any = null;

	ipcConnect() {
		const PIPE_NAME = 'ab2sd4';
		const PIPE_PATH = '\\\\.\\pipe\\';
		
		streamDeck.logger.info("First Disconnecting from IPC server!");
		this.client?.end();
		this.client = null;
		streamDeck.logger.info("Connecting to IPC server!");

		const client = net.createConnection(PIPE_PATH + PIPE_NAME, () => {
			streamDeck.logger.info('connected to server!');
		});
		
		client.on('data', (data) => {
			streamDeck.logger.info(`Received: ${data.toString()}`);
			this.data = data.toString();
		});
		
		client.on('end', () => {
			streamDeck.logger.info('Server just disconnected!');
			this.ipcClose();
		});
	}

	ipcClose() {
		this.client?.end();
		this.client = null;
		streamDeck.logger.info("Disconnected from IPC server!");
	}


	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
	 */
	override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
		const { settings } = ev.payload;
		if (typeof settings.enabled === 'undefined' || settings.enabled === null) {
			settings.enabled = false;
			settings.timer = null;
			ev.action.setSettings(settings);
			streamDeck.logger.info("INIT ENABLED 1: " + settings.enabled);
		}

		streamDeck.logger.info("INIT ENABLED 2: " + settings.enabled);
		
		return ev.action.setTitle(`Init: ${settings.enabled ? 'ON' : 'OFF'}`);
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
	 * settings using `setSettings` and `getSettings`.
	 */
	override async onKeyDown(ev1: KeyDownEvent<CounterSettings>): Promise<void> {
		try {
			// Update the count from the settings.
			const ev = ev1;
			const { settings } = ev.payload;

			if (typeof settings.enabled === 'undefined' || settings.enabled === null) {
				settings.enabled = false;
				settings.timer = null;
				ev.action.setSettings(settings);
				streamDeck.logger.info("KD ENABLED 0: " + settings.enabled);
				return;
			}

			streamDeck.logger.info("KD ENABLED 1: " + settings.enabled);
			
			settings.enabled = !settings.enabled;

			streamDeck.logger.info("KD ENABLED 2: " + settings.enabled);


			if (typeof settings.timer !== 'undefined' && settings.timer !== null) {
				streamDeck.logger.info("KD TIMER: " + settings.timer);

				// if (!settings.enabled) {
					streamDeck.logger.info("KD TURN OFF");

					// try get the timer and clear it
					if (this.timers.has(settings.timer)) {
						const timer = this.timers.get(settings.timer);
						clearInterval(timer);
						this.timers.delete(settings.timer);
						settings.timer = null;
						streamDeck.logger.info("KD CLEAR TIMER");
					} else {
						streamDeck.logger.info("KD TIMER NOT FOUND IN MAP");
					}
				// }
			}

			streamDeck.logger.info("KD NO TIMER");
			
			if (settings.enabled) {
				streamDeck.logger.info("KD TURN ON");

				streamDeck.logger.info("KD START TIMER");

				try {
					const uniqueId = randomUUID();
					this.timers.set(uniqueId,
						setInterval(() => {
						streamDeck.logger.info(`LOOP ENABLED: ${settings.enabled}`);
						streamDeck.logger.info(`LOOP TIMER: ${settings.timer}`);
						streamDeck.logger.info(`LOOP TYPE: ${this.type}`);
						streamDeck.logger.info(`LOOP DATA: ${this.data}`);

						// ev.action.setTitle(`L: ${settings.enabled ? 'ON' : 'OFF'}`);
						ev.action.setTitle(`${this.data}`);
					}, 1000));
					settings.timer = uniqueId;
				} catch (e) {
					streamDeck.logger.error(`Error starting timer:`);
					streamDeck.logger.error(e);
				}
			}
			

			await ev.action.setSettings(settings);
			await ev.action.setTitle(`KD2: ${settings.enabled ? 'ON' : 'OFF'}`);
		} catch (e) {
			streamDeck.logger.error(`Error in onKeyDown:`);
			streamDeck.logger.error(e);
		}
	}
}

/**
 * Settings for {@link IncrementCounter}.
 */
type CounterSettings = {
	// count?: number;
	// incrementBy?: number;

	enabled?: boolean;
	timer?: any;
};
