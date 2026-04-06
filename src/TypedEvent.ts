export type Handler<T> = (event: T) => void;

export class TypedEvent<T> {
  private readonly _handlers: Handler<T>[] = [];

  add(handler: Handler<T>): void {
    this._handlers.push(handler);
  }

  emit(event: T): void {
    for (const h of this._handlers) {
      h(event);
    }
  }
}
