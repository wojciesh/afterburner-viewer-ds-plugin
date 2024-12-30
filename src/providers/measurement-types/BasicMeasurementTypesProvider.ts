import {IMeasurementTypesProvider} from "./IMeasurementTypesProvider";

export class BasicMeasurementTypesProvider implements IMeasurementTypesProvider {

    protected allMeasurementTypes = [
        'Power',
        'CPU usage',
        'CPU clock',
        'CPU power',
        'Core clock',
        'RAM usage',
        'Memory usage',
        'Memory clock',
        'Commit charge',
        'GPU temperature',
        'GPU usage',
        'Fan speed',
        'Fan tachometer',
        'FB usage',
    ];

    getAll(): string[] {
        return this.allMeasurementTypes;
    }

    getDefault(): string {
        return this.allMeasurementTypes[0];
    }

    getNext(measurementType: string) {
        return this.allMeasurementTypes[
                (this.allMeasurementTypes.indexOf(measurementType) + 1)
                % this.allMeasurementTypes.length];
    }

    setTypes(newTypes: string[]): void {
        return; // Cannot change types in basic provider
    }
}