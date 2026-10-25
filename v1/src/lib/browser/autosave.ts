// WHY: A learner on a desktop browser can connect one backup file and trust
// that every change rewrites it. Phones cannot do this, so they keep the manual
// download. The file handle stays in IndexedDB; the key never enters the file.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-25 opencode: the standing file is a zip so it can carry local media;
// an old .json handle is retired once. [pack: teaching-layers]

import { exportBackupZip } from "@/lib/browser/archive";
import { onLibraryChange } from "@/lib/browser/changes";
import { browserStore, type StoredValue, type Store } from "@/lib/browser/store";

/** What this browser can do about a standing backup file. */
export interface AutosaveState {
  supported: boolean;
  fileName: string | null;
  lastSavedAt: string | null;
  permission: PermissionState | null;
}

/** The small part of the File System Access handle this app uses. */
interface AutosaveHandle {
  name: string;
  queryPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

interface AutosaveRow extends StoredValue {
  id: "file";
  handle: AutosaveHandle;
  lastSavedAt: string | null;
}

interface SavePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<AutosaveHandle>;
}

const ROW_ID = "file";
let timer: number | null = null;
let subscribed = false;

/** Can this browser rewrite a chosen file by itself? */
export function autosaveSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as SavePickerWindow).showSaveFilePicker === "function";
}

/** Read the chosen file's name and the last successful write, never the data. */
export async function autosaveState(store: Store = browserStore()): Promise<AutosaveState> {
  const row = await store.get<AutosaveRow>("autosave", ROW_ID);
  let permission: PermissionState | null = null;
  if (row?.handle.queryPermission) {
    try {
      permission = await row.handle.queryPermission({ mode: "readwrite" });
    } catch {
      permission = null;
    }
  }
  return {
    supported: autosaveSupported(),
    fileName: row?.handle.name ?? null,
    lastSavedAt: row?.lastSavedAt ?? null,
    permission,
  };
}

/** Ask the learner for one file, remember it, and write the first backup. */
export async function chooseAutosaveFile(store: Store = browserStore()): Promise<AutosaveState> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) throw new Error("This browser cannot rewrite a file by itself. Download a backup instead.");
  const handle = await picker({
    suggestedName: "flashcards-backup.zip",
    types: [{ description: "Flashcards backup", accept: { "application/zip": [".zip"] } }],
  });
  const row: AutosaveRow = { id: ROW_ID, handle, lastSavedAt: null };
  await store.put("autosave", row);
  await autosaveNow(store);
  return autosaveState(store);
}

/** Forget the standing file. The file itself is left where it is. */
export async function disconnectAutosave(store: Store = browserStore()): Promise<AutosaveState> {
  await store.delete("autosave", ROW_ID);
  return autosaveState(store);
}

/** Rewrite the chosen file now, if the browser still grants write access. */
export async function autosaveNow(store: Store = browserStore()): Promise<{ ok: boolean; message: string }> {
  const row = await store.get<AutosaveRow>("autosave", ROW_ID);
  if (!row) return { ok: false, message: "No backup file is connected." };
  // WHY: A .json file cannot carry local images or videos. Retire the old
  // handle instead of writing a backup that silently loses them.
  if (row.handle.name.toLowerCase().endsWith(".json")) {
    await store.delete("autosave", ROW_ID);
    return {
      ok: false,
      message: "The connected file is an old .json backup. Choose a new .zip backup file in Settings.",
    };
  }
  if (row.handle.queryPermission) {
    const permission = await row.handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      return { ok: false, message: "The browser needs permission again. Choose the backup file in Settings." };
    }
  }
  try {
    const blob = await exportBackupZip();
    const writable = await row.handle.createWritable();
    await writable.write(blob);
    await writable.close();
    const savedAt = new Date().toISOString();
    await store.put("autosave", { ...row, lastSavedAt: savedAt });
    return { ok: true, message: `The backup file was rewritten at ${savedAt}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The backup file could not be rewritten.",
    };
  }
}

/** Write after a quiet moment, so a burst of changes becomes one file write. */
export function scheduleAutosave(delayMs = 1200): void {
  if (typeof window === "undefined") return;
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void autosaveNow();
  }, delayMs);
}

/** Start listening once. Safe to call from every screen. */
export function startAutosave(): void {
  if (subscribed) return;
  subscribed = true;
  onLibraryChange(() => scheduleAutosave());
}
