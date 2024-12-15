import { randomUUID } from 'crypto';
import { ILogger } from "../helpers/logger/ILogger";
import { SvgRenderer } from "../helpers/SvgRenderer";
import { AfterburnerMeasurement } from "../models/AfterburnerMeasurement";
import { MeasurementSettings } from "../models/MeasurementSettings";
import { IMeasurementTypesProvider } from "../providers/measurement-types/IMeasurementTypesProvider";
import { IpcService } from "./IpcService";

export class MeasurementTimerManager implements IActivityChecker {

    private readonly timers = new Map<string, NodeJS.Timeout>(); // <timerUID, timer>
    private readonly timerMeasurementTypes = new Map<string, string>(); // <timerUID, measurementType>

    private data: string = '';

    constructor(private readonly logger: ILogger,
                private readonly measurementTypesProvider: IMeasurementTypesProvider
    ) {}

    init(ipcService: IpcService): void {
        ipcService.onDataReceived.subscribe((data) => {
            this.data = data;
        });
    }

    createTimer(action: any, measurementType: string, updateInterval: number = 500): string {
        const uniqueId = randomUUID();

        this.timers.set(
            uniqueId,
            setInterval(async () => {
                const data = this.data;
                if (data) {
                    await action.setTitle(``);

                    const type: string = this.getMeasurementTypeForTimer(uniqueId);
                    const measurements = JSON.parse(data) as AfterburnerMeasurement[];
                    const measurement = measurements.find((m: any) => m.Type.Name === type);

                    if (!measurement) {
                        this.logger.error(`Measurement not found for type: ${type}`);
                        return;
                    }

                    await action.setImage(
                        `data:image/svg+xml,${encodeURIComponent(SvgRenderer.render(measurement))}`
                    );
                }
            }, updateInterval)
        );

        this.setMeasurementTypeForTimer(uniqueId, measurementType);
        return uniqueId;
    }

    killTimer(timerUID: string | null | undefined): void {
        if (!timerUID) return;

        if (this.timers.has(timerUID)) {
            const timer = this.timers.get(timerUID);
            clearInterval(timer);
            this.timers.delete(timerUID);
            this.logger.debug(`Timer cleared: ${timerUID}`);
        } else {
            this.logger.error(`Timer not found in map: ${timerUID}`);
        }
    }

    setMeasurementTypeForTimer(timerUID: string, measurementType: string): void {
        this.timerMeasurementTypes.set(timerUID, measurementType);
    }

    getMeasurementTypeForTimer(timerUID: string): string {
        return this.timerMeasurementTypes.get(timerUID) || '';
    }

    restartMeasurementTimer(settings: MeasurementSettings, ev: any): void {
        settings.measurementType = settings.timer
            ? this.getMeasurementTypeForTimer(settings.timer)
            : this.measurementTypesProvider.getDefault();

        this.killTimer(settings.timer);

        if (settings.enabled) {
            this.logger.debug("Starting timer...");
            try {
                settings.timer = this.createTimer(ev.action, settings.measurementType);
                this.setMeasurementTypeForTimer(settings.timer, settings.measurementType);
            } catch (e) {
                this.logger.error(`Error starting timer: ${e}`);
            }
        }
    }

    setNextMeasurementForTimer(settings: MeasurementSettings): void {
        settings.measurementType = this.measurementTypesProvider.getNext(settings.measurementType);

        if (settings.timer != null) {
            this.setMeasurementTypeForTimer(settings.timer, settings.measurementType);
        }
    }

    isAnyActive(): boolean {
        return this.timers.size > 0;
    }
}

export interface IActivityChecker {
    isAnyActive(): boolean;
}
