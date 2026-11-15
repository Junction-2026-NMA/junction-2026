// The web side of UserDefaults: `localStorage` (every access wrapped in try/catch, because private windows and
// blocked storage throw) or a throwaway in-memory store (the `screenshots=1` launch, like the iOS suite
// "fi.sisu.screenshots"). Same keys as iOS. Values are stored as text: strings as is, booleans as "1"/"0" and
// Codable data as JSON.

export interface SisuDefaults {
  /** `defaults.object(forKey:) != nil`. */
  has(key: string): boolean;
  /** `defaults.string(forKey:)`. */
  string(key: string): string | null;
  /** `defaults.bool(forKey:)`: false when missing. */
  bool(key: string): boolean;
  /** `defaults.data(forKey:)` + `JSONDecoder`: the parsed JSON, or null when missing or not JSON. */
  json(key: string): unknown;
  setString(key: string, value: string): void;
  setBool(key: string, value: boolean): void;
  /** `JSONEncoder` + `defaults.set(data, forKey:)`. */
  setJSON(key: string, value: unknown): void;
  /** `defaults.removeObject(forKey:)`. */
  remove(key: string): void;
  /** Removes every key that starts with `prefix` (per-customer values such as `sisu.lessons.<id>`). */
  removePrefix(prefix: string): void;
}

interface TextStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

function defaultsOver(store: TextStore): SisuDefaults {
  return {
    has: (key) => store.get(key) !== null,
    string: (key) => store.get(key),
    bool: (key) => {
      const value = store.get(key)?.toLowerCase();
      return value === "1" || value === "true" || value === "yes";
    },
    json: (key) => {
      const text = store.get(key);
      if (text === null) return null;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    },
    setString: (key, value) => store.set(key, value),
    setBool: (key, value) => store.set(key, value ? "1" : "0"),
    setJSON: (key, value) => {
      try {
        store.set(key, JSON.stringify(value));
      } catch {
        // Not encodable: nothing is stored, as with a failed `try? JSONEncoder().encode`.
      }
    },
    remove: (key) => store.remove(key),
    removePrefix: (prefix) => store.keys().filter((key) => key.startsWith(prefix)).forEach((key) => store.remove(key)),
  };
}

/** `UserDefaults.standard`: the browser's localStorage. Falls back to memory when storage is unavailable. */
export function localDefaults(): SisuDefaults {
  const memory = new Map<string, string>();
  const storage = (): Storage | null => {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  };
  return defaultsOver({
    get: (key) => {
      // What this page wrote wins (a write the storage refused still counts for this page load).
      if (memory.has(key)) return memory.get(key) ?? null;
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      memory.set(key, value);
      try {
        storage()?.setItem(key, value);
      } catch {
        // Full or blocked: the value lives in memory for this page load.
      }
    },
    remove: (key) => {
      memory.delete(key);
      try {
        storage()?.removeItem(key);
      } catch {
        // Blocked: nothing to remove.
      }
    },
    keys: () => {
      const keys = new Set(memory.keys());
      try {
        const store = storage();
        for (let index = 0; store && index < store.length; index += 1) {
          const key = store.key(index);
          if (key !== null) keys.add(key);
        }
      } catch {
        // Blocked: only this page's own values.
      }
      return [...keys];
    },
  });
}

/** A fresh store that lives only as long as the page (screenshots and tests). */
export function memoryDefaults(): SisuDefaults {
  const memory = new Map<string, string>();
  return defaultsOver({
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => { memory.set(key, value); },
    remove: (key) => { memory.delete(key); },
    keys: () => [...memory.keys()],
  });
}
