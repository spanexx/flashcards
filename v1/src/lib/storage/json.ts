// WHY: Learner data must never half-write. A write goes to a temporary file
// and moves into place, and a damaged file is moved aside rather than silently
// pretending it never existed.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { withLock } from "@/lib/storage/mutex";
import { ensureDir } from "@/lib/storage/paths";
import path from "node:path";

/** Read JSON, returning the fallback when the file does not exist yet. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await readFile(file, "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    if (error instanceof SyntaxError) {
      // A damaged file is kept for inspection, and the app starts from the
      // fallback so one bad byte cannot stop the learner's day.
      await rename(file, `${file}.broken-${Date.now()}`).catch(() => undefined);
      return fallback;
    }
    throw error;
  }
}

/** Write JSON whole: temporary file first, then a move into place. */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await withLock(file, async () => {
    await ensureDir(path.dirname(file));
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    try {
      await rename(temporary, file);
    } catch {
      // Windows can refuse to replace an existing file in one move. Removing
      // the old file first is still safer than writing into the live file.
      await unlink(file).catch(() => undefined);
      await rename(temporary, file);
    }
  });
}
