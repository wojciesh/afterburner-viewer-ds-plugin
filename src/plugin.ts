import streamDeck, {LogLevel} from "@elgato/streamdeck";
import { MeasurementController } from "./actions/measurement-controller";
import { DynamicMeasurementTypesProvider } from "./providers/measurement-types/DynamicMeasurementTypesProvider";
import { PipeIpcProviderFactory } from "./providers/ipc/PipeIpcProviderFactory";

streamDeck.logger.setLevel(LogLevel.DEBUG);

const measurementController = new MeasurementController(
    new PipeIpcProviderFactory(),
    new DynamicMeasurementTypesProvider(),
    streamDeck.logger);

streamDeck.actions.registerAction(measurementController);

streamDeck.connect();
