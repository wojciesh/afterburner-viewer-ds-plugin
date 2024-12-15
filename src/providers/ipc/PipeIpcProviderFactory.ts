import { IIpcProvider } from "./IIpcProvider";
import { IIpcProviderFactory } from "./IIpcProviderFactory";
import { PipeIpcProvider } from "./PipeIpcProvider";

export class PipeIpcProviderFactory implements IIpcProviderFactory {

    create(): IIpcProvider {
        return new PipeIpcProvider();
    }
}