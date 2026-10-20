// WHY: One local process still has concurrent requests, and two writes to the
// same file can interleave. A queue per file keeps each write whole without a
// database or a lock manager.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

const chains = new Map<string, Promise<unknown>>();

/** Run one job at a time for a key. The next job starts whatever the last did. */
export function withLock<T>(key: string, job: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const next = previous.then(job, job);
  chains.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}
