import streamDeck, {LogLevel} from "@elgato/streamdeck";
import { MeasurementController } from "./actions/measurement-controller";

streamDeck.logger.setLevel(LogLevel.DEBUG);

const measurementController = new MeasurementController();

streamDeck.actions.registerAction(measurementController);

// Finally, connect to the Stream Deck.
streamDeck.connect();
