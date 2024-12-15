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