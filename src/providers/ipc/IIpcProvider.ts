import { Observable } from "../../helpers/Observable";

export interface IIpcProvider {

    onConnectionOpened: Observable<void>;
    onConnectionClosed: Observable<void>;
    onDataReceived: Observable<string>;

    connect(serverName: string): void;
    close(): void;
    isConnected(): boolean;
}