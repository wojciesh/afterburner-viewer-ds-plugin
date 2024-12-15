import {IIpcClient} from "./IIpcClient";
import {IpcClient} from "./IpcClient";
import {ApplicationDidLaunchEvent, ApplicationDidTerminateEvent, streamDeck} from "@elgato/streamdeck";
import {Observable} from "../helpers/Observable";

export class IpcService {

    protected readonly IPC_PIPE_NAME = 'ab2sd-1';

    protected isIpcInitialized: boolean = false;
    private isIpcServerRunning: boolean = false;

    protected ipcClient: IIpcClient | null = null;
    protected ipcTimer: NodeJS.Timeout | null = null;

    readonly onDataReceived = new Observable<string>();
    // readonly onConnectionOpened = new Observable<void>();
    // readonly onConnectionClosed = new Observable<void>();

    constructor() {
        streamDeck.system.onApplicationDidLaunch((ev: ApplicationDidLaunchEvent) => {
            streamDeck.logger.info(`ApplicationDidLaunchEvent: ${ev.application}`);
            this.isIpcServerRunning = true;
        });
        streamDeck.system.onApplicationDidTerminate((ev: ApplicationDidTerminateEvent) => {
            streamDeck.logger.info(`ApplicationDidTerminateEvent: ${ev.application}`);
            this.isIpcServerRunning = false;
        });
    }

    protected isIpcConnected() : boolean {
        return this.ipcClient?.isConnected() ?? false;
    }

    protected ipcConnect() {
        if (!this.isIpcInitialized) {

            this.ipcClient = new IpcClient();

            this.ipcClient.onDataReceived.subscribe((data) => {
                this.onDataReceived.notify(data);
            });

            // this.ipcClient.onConnectionOpened.subscribe(() => {
            // });
            // this.ipcClient.onConnectionClosed.subscribe(() => {
            // });

            this.isIpcInitialized = true;
        }

        this.ipcClient?.connect(this.IPC_PIPE_NAME);
    }

    ipcClose() {
        if (this.ipcClient !== null) {
            this.ipcClient.close();
            this.ipcClient = null;
            this.isIpcInitialized = false;
        }
    }

    restartIpcTimer() {
        if (this.ipcTimer)
            clearInterval(this.ipcTimer);

        this.ipcTimer = setInterval(() => {

            if (this.isIpcServerRunning
                && this.isAnyMeasurementActive()
            ) {
                if (!this.isIpcConnected()) {
                    this.ipcConnect();
                }
            } else {
                this.ipcClose();
            }

        }, 250);
    }

    private isAnyMeasurementActive() {
        return true;    // TODO: Implement this!
        // return this.timers.size > 0;
    }
}