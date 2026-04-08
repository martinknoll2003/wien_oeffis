type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TtlCache<T> {
  #entries = new Map<string, CacheEntry<T>>();

  getFresh(key: string, now = Date.now()): T | null {
    const entry = this.#entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      return null;
    }

    return entry.value;
  }

  getAny(key: string): T | null {
    return this.#entries.get(key)?.value ?? null;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    this.#entries.set(key, {
      value,
      expiresAt: now + ttlMs,
    });
  }
}
