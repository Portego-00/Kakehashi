/** A serial, per-name Web Locks implementation for browser persistence tests. */
export function createTestWebLocks() {
  const tails = new Map<string, Promise<void>>();
  return {
    async request<T>(name: string, _options: LockOptions, callback: (lock: Lock) => T | Promise<T>): Promise<T> {
      const previous = tails.get(name);
      let release!: () => void;
      const tail = new Promise<void>((resolve) => { release = resolve; });
      tails.set(name, tail);
      await previous;
      try { return await callback({ name, mode: "exclusive" }); }
      finally {
        release();
        if (tails.get(name) === tail) tails.delete(name);
      }
    },
  };
}
