import { BasicMeasurementTypesProvider } from "./BasicMeasurementTypesProvider";

export class DynamicMeasurementTypesProvider extends BasicMeasurementTypesProvider {

    constructor() {
        super();
        this.setTypes([]);
    }

    override setTypes(newTypes: string[]): void {
        this.allMeasurementTypes = newTypes;
    }
}