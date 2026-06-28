declare module 'petite-vue' {
  export function createApp(initialData?: Record<string, any>): {
    mount(el?: string | Element): void;
    unmount(): void;
  };
  export function reactive<T extends object>(obj: T): T;
  export function nextTick(fn: () => void): void;
}
