/**
 * Namespaced, versioned `localStorage` access.
 *
 * The only personal data this app persists are **own registration receipts** and the
 * in-progress public form; everything is versioned so a schema change drops old
 * entries instead of crashing on parse. Tokens/cookies are never stored here.
 */
const NAMESPACE = 'events-f';
const SCHEMA_VERSION = 1;

interface StoredEnvelope<T> {
  readonly version: number;
  readonly savedAt: string;
  readonly value: T;
}

export interface ReadOptions {
  /** Drops the entry when older than this many days. */
  readonly maxAgeDays?: number;
}

export const storage = {
  read<T>(key: string, options?: ReadOptions): T | null {
    const raw = safeStorage()?.getItem(scopedKey(key)) ?? null;
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as StoredEnvelope<T>;
      if (parsed.version !== SCHEMA_VERSION) {
        storage.remove(key);
        return null;
      }
      if (options?.maxAgeDays !== undefined && isExpired(parsed.savedAt, options.maxAgeDays)) {
        storage.remove(key);
        return null;
      }
      return parsed.value;
    } catch {
      storage.remove(key);
      return null;
    }
  },

  write<T>(key: string, value: T): void {
    const envelope: StoredEnvelope<T> = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      value,
    };
    safeStorage()?.setItem(scopedKey(key), JSON.stringify(envelope));
  },

  remove(key: string): void {
    safeStorage()?.removeItem(scopedKey(key));
  },

  /** Removes every key owned by this app (privacy "borrar mis datos"). */
  clearNamespace(): void {
    const store = safeStorage();
    if (!store) {
      return;
    }
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(`${NAMESPACE}:`)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      store.removeItem(key);
    }
  },
};

function scopedKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

function isExpired(savedAt: string, maxAgeDays: number): boolean {
  const ageMs = Date.now() - new Date(savedAt).getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
