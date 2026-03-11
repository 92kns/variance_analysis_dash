type Listener<T> = (state: T, prev: T) => void;

export interface Store<T> {
  get(): T;
  set(partial: Partial<T>): void;
  subscribe(fn: Listener<T>): () => void;
}

export function createState<T extends object>(
  initial: T,
): Store<T> {
  let current = { ...initial };
  const listeners = new Set<Listener<T>>();

  return {
    get: () => current,
    set(partial) {
      const prev = current;
      current = { ...current, ...partial };
      for (const fn of listeners) fn(current, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
