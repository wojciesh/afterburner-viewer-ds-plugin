import streamDeck, {LogLevel} from "@elgato/streamdeck";
import { MeasurementController } from "./actions/measurement-controller";
import {BasicMeasurementTypesProvider} from "./providers/BasicMeasurementTypesProvider";

streamDeck.logger.setLevel(LogLevel.DEBUG);

const measurementController = new MeasurementController(
    new BasicMeasurementTypesProvider(),
    streamDeck.logger);

streamDeck.actions.registerAction(measurementController);

// Finally, connect to the Stream Deck.
streamDeck.connect();
