import { IIpcClient } from "./IIpcClient";
import { Observable } from "../helpers/Observable";
import net from "net";

export class IpcClient implements IIpcClient {
  private client: net.Socket | null = null;
  
  public readonly onConnectionOpened = new Observable<void>();
  public readonly onConnectionClosed = new Observable<void>();
  public readonly onDataReceived = new Observable<string>();
  
  public connect(serverName: string) {
    const pipeName = "\\\\.\\pipe\\" + serverName;

    try {
      this.close();
    } catch { }

    this.client = net.createConnection(pipeName, () => {
      this.onConnectionOpened.notify();
    });

    this.client.on("data", (data: Buffer) => {
      const message = data.toString();
      this.onDataReceived.notify(message);
    });

    this.client.on("end", () => {
      this.close();
    });

    this.client.on("error", (err) => {
    //   console.error(`IPC Client error: ${err.message}`);
      this.close();
    });
  }

  public close() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.onConnectionClosed.notify();
    }
  }

  public isConnected() {
    return this.client !== null;
  }
}
