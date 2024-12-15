import { randomUUID } from 'crypto';
import { ILogger } from "../helpers/logger/ILogger";
import { SvgRenderer } from "../helpers/SvgRenderer";
import { AfterburnerMeasurement } from "../models/AfterburnerMeasurement";
import { MeasurementSettings } from "../models/MeasurementSettings";
import { IMeasurementTypesProvider } from "../providers/measurement-types/IMeasurementTypesProvider";
import { IpcService } from "./IpcService";

export interface IMeasurementsManager {
    set data(value: string);
    restartMeasurementTimer(settings: MeasurementSettings, ev: any): void;
    setMeasurementTypeForTimer(timerUID: string, measurementType: string): void;
    setNextMeasurementForTimer(settings: MeasurementSettings): void;
    killTimer(timerUID: string | null | undefined): void;
}

export class MeasurementTimerManager implements IMeasurementsManager, IActivityChecker {

    private readonly timers = new Map<string, (data: string) => void | Promise<void>>();  // <timerUID, function>
    private readonly timerMeasurementTypes = new Map<string, string>(); // <timerUID, measurementType>

    private _data: string = '';
    get data(): string {
        return this._data;
    }
    set data(value: string) {
        this._data = value;

        this.timers.forEach(async (timerFunc, timerUID) => {
            await timerFunc(value);
        });
    }

    constructor(private readonly measurementTypesProvider: IMeasurementTypesProvider,
                private readonly logger: ILogger
    ) {}

    private createTimer(action: any, measurementType: string): string {
        const uniqueId: string = randomUUID();
        this.setMeasurementTypeForTimer(uniqueId, measurementType);
        this.timers.set(
            uniqueId,
            async (aData: string) => {
                if (!aData) return;
                await action.setTitle(``);
                const type: string = this.getMeasurementTypeForTimer(uniqueId);
                const measurements = JSON.parse(aData) as AfterburnerMeasurement[];
                const measurement = measurements.find((m: any) => m.Type.Name === type);
                if (!measurement) {
                    this.logger.error(`Measurement not found for type: ${type}`);
                    return;
                }
                await action.setImage(
                    `data:image/svg+xml,${encodeURIComponent(SvgRenderer.render(measurement))}`
                );
            });
        return uniqueId;
    }

    killTimer(timerUID: string | null | undefined): void {
        if (timerUID && this.timers.has(timerUID)) {
            this.timers.delete(timerUID);
            this.logger.debug(`Timer cleared: ${timerUID}`);
        } else {
            this.logger.error(`Timer not found in map: ${timerUID}`);
        }
    }

    setMeasurementTypeForTimer(timerUID: string, measurementType: string): void {
        this.timerMeasurementTypes.set(timerUID, measurementType);
    }

    private getMeasurementTypeForTimer(timerUID: string): string {
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
