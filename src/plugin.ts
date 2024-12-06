import streamDeck, { LogLevel, ApplicationDidLaunchEvent, ApplicationDidTerminateEvent } from "@elgato/streamdeck";

import { MeasurementController } from "./actions/measurement-controller";

streamDeck.logger.setLevel(LogLevel.TRACE);

const btn1 = new MeasurementController();

streamDeck.actions.registerAction(btn1);

streamDeck.system.onApplicationDidLaunch((ev: ApplicationDidLaunchEvent) => {
    streamDeck.logger.info(`Launched: ${ev.application}`);
    btn1.isIpcServerRunning = true;
});
streamDeck.system.onApplicationDidTerminate((ev: ApplicationDidTerminateEvent) => {
	streamDeck.logger.info(`Terminated: ${ev.application}`);
    btn1.isIpcServerRunning = false;
});

// Finally, connect to the Stream Deck.
streamDeck.connect();
