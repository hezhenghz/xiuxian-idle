type Handler = (...args: any[]) => void;

class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]) {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(...args);
    }
  }
}

export const bus = new EventBus();
