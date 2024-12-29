import streamDeck, {LogLevel} from "@elgato/streamdeck";
import { MeasurementController } from "./actions/measurement-controller";
import { BasicMeasurementTypesProvider } from "./providers/measurement-types/BasicMeasurementTypesProvider";
import { PipeIpcProviderFactory } from "./providers/ipc/PipeIpcProviderFactory";

streamDeck.logger.setLevel(LogLevel.DEBUG);

const measurementController = new MeasurementController(
    new PipeIpcProviderFactory(),
    new BasicMeasurementTypesProvider(),
    streamDeck.logger);

streamDeck.actions.registerAction(measurementController);

streamDeck.connect();
