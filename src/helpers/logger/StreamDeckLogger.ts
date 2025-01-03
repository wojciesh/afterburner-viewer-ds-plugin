import { ILogger } from "./ILogger";
import { streamDeck } from "@elgato/streamdeck";

export class StreamDeckLogger implements ILogger {
    info(msg: string) {
        streamDeck.logger.info(msg);
    }
    error(msg: string) {
        streamDeck.logger.error(msg);
    }
    debug(msg: string) {
        streamDeck.logger.debug(msg);
    }
}