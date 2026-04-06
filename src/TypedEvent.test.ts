import { TypedEvent } from './TypedEvent';

describe('TypedEvent', () => {
  it('calls a single handler with the emitted event', () => {
    const event = new TypedEvent<string>();
    const received: string[] = [];
    event.add(v => received.push(v));
    event.emit('hello');
    expect(received).toEqual(['hello']);
  });

  it('calls multiple handlers in registration order', () => {
    const event = new TypedEvent<number>();
    const order: string[] = [];
    event.add(() => order.push('first'));
    event.add(() => order.push('second'));
    event.emit(1);
    expect(order).toEqual(['first', 'second']);
  });

  it('does not throw when no handlers are registered', () => {
    const event = new TypedEvent<string>();
    expect(() => event.emit('x')).not.toThrow();
  });

  it('passes the event value correctly to the handler', () => {
    const event = new TypedEvent<{ id: number }>();
    let received: { id: number } | null = null;
    event.add(v => { received = v; });
    event.emit({ id: 42 });
    expect(received).toEqual({ id: 42 });
  });
});
