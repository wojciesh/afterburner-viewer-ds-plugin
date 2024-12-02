import streamDeck, { LogLevel, ApplicationDidLaunchEvent, ApplicationDidTerminateEvent } from "@elgato/streamdeck";

import { IncrementCounter } from "./actions/increment-counter";

streamDeck.logger.setLevel(LogLevel.TRACE);

const btn1 = new IncrementCounter();

streamDeck.actions.registerAction(btn1);

streamDeck.system.onDidReceiveDeepLink((ev) => {
	const { path, fragment } = ev.url;
	streamDeck.logger.info(`Path = ${path}`);
	streamDeck.logger.info(`Fragment = ${fragment}`);
    btn1.type = path;
    btn1.data = fragment;
});

streamDeck.system.onApplicationDidLaunch((ev: ApplicationDidLaunchEvent) => {
    streamDeck.logger.info(ev.application); // e.g. "Elgato Wave Link.exe"
    btn1.ipcConnect();
});
// setTimeout(() => {
//     streamDeck.logger.info("Connecting to IPC");
//     btn1.ipcConnect();
//     streamDeck.logger.info("Connected to IPC");
// }, 2000);

streamDeck.system.onApplicationDidTerminate((ev: ApplicationDidTerminateEvent) => {
	streamDeck.logger.info(ev.application); // e.g. "Elgato Wave Link.exe"
    btn1.ipcClose();
});

// Finally, connect to the Stream Deck.
streamDeck.connect();
