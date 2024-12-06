import net from "net";

export class IpcClient {
  private client: net.Socket | null = null;
  
  public readonly onConnectionOpened = new Observable<void>();
  public readonly onConnectionClosed = new Observable<void>();
  public readonly onDataReceived = new Observable<string>();
  
  public ipcConnect(serverName: string) {
    const pipeName = "\\\\.\\pipe\\" + serverName;

    try {
      this.ipcClose();
    } catch { }

    this.client = net.createConnection(pipeName, () => {
      this.onConnectionOpened.notify();
    });

    this.client.on("data", (data: Buffer) => {
      const message = data.toString();
      this.onDataReceived.notify(message);
    });

    this.client.on("end", () => {
      this.ipcClose();
    });

    this.client.on("error", (err) => {
    //   console.error(`IPC Client error: ${err.message}`);
      this.ipcClose();
    });
  }

  public ipcClose() {
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

export class Observable<T> {
	private readonly observers = new Set<(data: T) => void>();

	subscribe(func: (data: T) => void) {
	  this.observers.add(func);
	}
  
	unsubscribe(func: (data: T) => void) {
	  this.observers.delete(func);
	}
  
	unsubscribeAll() {
	  this.observers.clear();
	}
  
	notify(data: T) {
	  this.observers.forEach((observer) => observer(data));
	}
}
