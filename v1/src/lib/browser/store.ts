// WHY: Learner data must live in the browser and nowhere else. This module is
// the one seam between the app and storage: an IndexedDB adapter for the real
// browser and a memory adapter for tests, both behind the same small interface.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-23 opencode: the jobs store is an additive version 3 upgrade. [pack: background-jobs]

/** The object stores that hold the library, the record and the settings. */
export const STORE_NAMES = [
  "packs",
  "cards",
  "evidence",
  "sessions",
  "prompts",
  "settings",
  "meta",
  "autosave",
  "jobs",
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

/** One value in the store. Every stored thing carries its own id. */
export interface StoredValue {
  id: string;
}

/** The storage contract the rest of the app uses. */
export interface Store {
  get<T extends StoredValue>(store: StoreName, id: string): Promise<T | null>;
  put<T extends StoredValue>(store: StoreName, value: T): Promise<void>;
  delete(store: StoreName, id: string): Promise<void>;
  all<T extends StoredValue>(store: StoreName): Promise<T[]>;
  clear(store: StoreName): Promise<void>;
}

/** Copy a value so a caller can never mutate what is stored by accident. */
function copy<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The in-memory implementation used by tests and by a non-browser render. */
export class MemoryStore implements Store {
  private readonly stores = new Map<StoreName, Map<string, StoredValue>>();

  /** The map for one store, created on first use. */
  private map(store: StoreName): Map<string, StoredValue> {
    let found = this.stores.get(store);
    if (!found) {
      found = new Map<string, StoredValue>();
      this.stores.set(store, found);
    }
    return found;
  }

  async get<T extends StoredValue>(store: StoreName, id: string): Promise<T | null> {
    const value = this.map(store).get(id);
    return value ? copy(value as T) : null;
  }

  async put<T extends StoredValue>(store: StoreName, value: T): Promise<void> {
    this.map(store).set(value.id, copy(value));
  }

  async delete(store: StoreName, id: string): Promise<void> {
    this.map(store).delete(id);
  }

  async all<T extends StoredValue>(store: StoreName): Promise<T[]> {
    return [...this.map(store).values()].map((value) => copy(value as T));
  }

  async clear(store: StoreName): Promise<void> {
    this.map(store).clear();
  }
}

/** Turn an IndexedDB request into a promise without hiding its error. */
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The browser store refused the request."));
  });
}

/** Wait for a transaction so a write is actually finished before the caller moves on. */
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The browser store could not finish."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The browser store stopped the write."));
  });
}

let database: Promise<IDBDatabase> | null = null;

/** Open (and on first use create) the one database this app owns. */
function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("flashcards", 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("The browser store could not open."));
      request.onblocked = () =>
        reject(new Error("Close the other Flashcards tabs so this tab can update the library."));
    });
  }
  return database;
}

/** The IndexedDB implementation used by the real browser. */
export function indexedDbStore(): Store {
  return {
    async get<T extends StoredValue>(store: StoreName, id: string): Promise<T | null> {
      const db = await openDatabase();
      const transaction = db.transaction(store, "readonly");
      const result = await requestResult(transaction.objectStore(store).get(id));
      return (result as T | undefined) ?? null;
    },

    async put<T extends StoredValue>(store: StoreName, value: T): Promise<void> {
      const db = await openDatabase();
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).put(value);
      await transactionDone(transaction);
    },

    async delete(store: StoreName, id: string): Promise<void> {
      const db = await openDatabase();
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).delete(id);
      await transactionDone(transaction);
    },

    async all<T extends StoredValue>(store: StoreName): Promise<T[]> {
      const db = await openDatabase();
      const transaction = db.transaction(store, "readonly");
      const result = await requestResult(transaction.objectStore(store).getAll());
      return result as T[];
    },

    async clear(store: StoreName): Promise<void> {
      const db = await openDatabase();
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).clear();
      await transactionDone(transaction);
    },
  };
}

let current: Store | null = null;

/** The store the app uses. IndexedDB in a browser, memory everywhere else. */
export function browserStore(): Store {
  if (!current) current = typeof indexedDB === "undefined" ? new MemoryStore() : indexedDbStore();
  return current;
}

/** Replace the store for a test or for a deliberate reset. */
export function setBrowserStore(store: Store | null): void {
  current = store;
}
