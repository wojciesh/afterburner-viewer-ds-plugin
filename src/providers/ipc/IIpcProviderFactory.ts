import { IIpcProvider } from "./IIpcProvider";

export interface IIpcProviderFactory {
    create(): IIpcProvider;
}