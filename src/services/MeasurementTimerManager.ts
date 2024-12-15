import { randomUUID } from 'crypto';
import { ILogger } from "../helpers/logger/ILogger";
import { SvgRenderer } from "../helpers/SvgRenderer";
import { AfterburnerMeasurement } from "../models/AfterburnerMeasurement";

export class MeasurementTimerManager {
    private readonly timers = new Map<string, NodeJS.Timeout>(); // <timerUID, timer>
    private readonly timerMeasurementTypes = new Map<string, string>(); // <timerUID, measurementType>

    constructor(private readonly logger: ILogger, private readonly getData: () => string) {}

    public createTimer(
        action: any,
        measurementType: string,
        updateInterval: number = 500
    ): string {
        const uniqueId = randomUUID();

        this.timers.set(
            uniqueId,
            setInterval(async () => {
                const data = this.getData();
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

    public killTimer(timerUID: string | null): void {
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

    public setMeasurementTypeForTimer(timerUID: string, measurementType: string): void {
        this.timerMeasurementTypes.set(timerUID, measurementType);
    }

    public getMeasurementTypeForTimer(timerUID: string): string {
        return this.timerMeasurementTypes.get(timerUID) || '';
    }

    public clearAllTimers(): void {
        this.timers.forEach((timer, timerUID) => {
            clearInterval(timer);
            this.logger.debug(`Timer cleared: ${timerUID}`);
        });
        this.timers.clear();
        this.timerMeasurementTypes.clear();
    }
}
