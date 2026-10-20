// WHY: Autosave must notice every library change without each screen calling
// it by hand. The repository rings this small bell after a successful write;
// the autosave adapter listens once. Nothing here reads or writes data.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

type Listener = () => void;

const listeners = new Set<Listener>();
let suspended = 0;

/** Ring the bell after a write. A suspended library stays quiet. */
export function markChanged(): void {
  if (suspended > 0) return;
  for (const listener of listeners) listener();
}

/** Listen for writes. Returns the function that stops listening. */
export function onLibraryChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Hold the bell while a whole-file operation runs, so autosave never writes a
 * half-restored library over the learner's chosen file.
 */
export function suspendChanges(): void {
  suspended += 1;
}

/** Let the bell ring again after the whole-file operation finishes. */
export function resumeChanges(): void {
  suspended = Math.max(0, suspended - 1);
}
