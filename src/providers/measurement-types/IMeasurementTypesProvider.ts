export interface IMeasurementTypesProvider {
    getDefault(): string;
    getNext(currentMeasurementType: string): string;
    getAll(): string[];
}