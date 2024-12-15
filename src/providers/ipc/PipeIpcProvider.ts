import { IIpcProvider } from "./IIpcProvider";
import { Observable } from "../../helpers/Observable";
import net from "net";

export class PipeIpcProvider implements IIpcProvider {

  readonly onConnectionOpened = new Observable<void>();
  readonly onConnectionClosed = new Observable<void>();
  readonly onDataReceived = new Observable<string>();

  private client: net.Socket | null = null;

  connect(serverName: string) {
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

  close() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.onConnectionClosed.notify();
    }
  }

  isConnected() {
    return this.client !== null;
  }
}
