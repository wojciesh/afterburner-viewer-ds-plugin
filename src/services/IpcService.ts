import { IIpcProvider } from "../providers/ipc/IIpcProvider";
import { Observable } from "../helpers/Observable";
import { IIpcProviderFactory } from "../providers/ipc/IIpcProviderFactory";
import { ApplicationDidLaunchEvent, ApplicationDidTerminateEvent, streamDeck } from "@elgato/streamdeck";
import { IActivityChecker } from "./MeasurementTimerManager";

export class IpcService {

    protected readonly IPC_PIPE_NAME = 'ab2sd-1';

    protected isIpcInitialized: boolean = false;
    private isIpcServerRunning: boolean = false;

    protected ipcProvider: IIpcProvider | null = null;
    protected ipcTimer: NodeJS.Timeout | null = null;

    readonly onDataReceived = new Observable<string>();
    // readonly onConnectionOpened = new Observable<void>();
    // readonly onConnectionClosed = new Observable<void>();

    constructor(private readonly ipcFactory: IIpcProviderFactory,
                private readonly measurementTimersActivityChecker: IActivityChecker
    ) {
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
        return this.ipcProvider?.isConnected() ?? false;
    }

    protected ipcConnect() {
        if (!this.isIpcInitialized) {

            this.ipcProvider = this.ipcFactory.create();

            this.ipcProvider.onDataReceived.subscribe((data) => {
                this.onDataReceived.notify(data);
            });

            // this.ipcClient.onConnectionOpened.subscribe(() => {
            // });
            // this.ipcClient.onConnectionClosed.subscribe(() => {
            // });

            this.isIpcInitialized = true;
        }

        this.ipcProvider?.connect(this.IPC_PIPE_NAME);
    }

    ipcClose() {
        if (this.ipcProvider !== null) {
            this.ipcProvider.close();
            this.ipcProvider = null;
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
        return this.measurementTimersActivityChecker.isAnyActive();
    }
}