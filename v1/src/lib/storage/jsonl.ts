// WHY: Evidence is append-only. A line appended is a line that exists, and no
// code path in this app rewrites the file.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { appendFile, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { withLock } from "@/lib/storage/mutex";
import { ensureDir } from "@/lib/storage/paths";
import path from "node:path";

/** Add one line to an append-only file. The lock keeps lines whole. */
export async function appendJsonl(file: string, value: unknown): Promise<void> {
  await withLock(file, async () => {
    await ensureDir(path.dirname(file));
    await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
  });
}

/** Add many lines in one locked job, so a batch lands together. */
export async function appendJsonlMany(file: string, values: unknown[]): Promise<void> {
  if (values.length === 0) return;
  await withLock(file, async () => {
    await ensureDir(path.dirname(file));
    const lines = values.map((value) => `${JSON.stringify(value)}\n`).join("");
    await appendFile(file, lines, "utf8");
  });
}

/**
 * Replace a whole JSONL file. This exists for one deliberate act only:
 * deleting a card deletes its evidence. It is never used by the answer path.
 */
export async function writeJsonl(file: string, values: unknown[]): Promise<void> {
  await withLock(file, async () => {
    await ensureDir(path.dirname(file));
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    const lines = values.map((value) => `${JSON.stringify(value)}\n`).join("");
    await writeFile(temporary, lines, "utf8");
    try {
      await rename(temporary, file);
    } catch {
      await unlink(file).catch(() => undefined);
      await rename(temporary, file);
    }
  });
}

/** Read every line. A damaged line is skipped, never allowed to stop a read. */
export async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const text = await readFile(file, "utf8");
    const rows: T[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        rows.push(JSON.parse(trimmed) as T);
      } catch {
        // Skip the broken line; the rest of the record is still readable.
      }
    }
    return rows;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
