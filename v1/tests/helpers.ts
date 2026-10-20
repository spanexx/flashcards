// WHY: Tests build the same small card over and over, and a temp folder is the
// only safe place to prove storage behaviour. Both live here so every test file
// shares one honest definition.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Card, CardSource, EvidenceRow, Outcome } from "@/lib/shared/types";
import { buildCard } from "@/lib/core/card";

/** A valid cloze source ("Piję kawę." hiding "kawę"). */
export function makeSource(overrides: Partial<CardSource> = {}): CardSource {
  return {
    summary: "Piję kawę",
    topics: ["cases"],
    tags: ["accusative"],
    prompt: [
      { type: "text", text: "Piję " },
      { type: "blank", id: "b1" },
      { type: "text", text: "." },
    ],
    answer: [{ type: "text", text: "Piję kawę." }],
    answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
    fullLine: "Piję kawę.",
    ...overrides,
  };
}

/** A built card with a chosen id. */
export function makeCard(
  id = "card:test-1",
  overrides: Partial<CardSource> = {},
  createdAt = "2026-10-01T00:00:00.000Z",
): Card {
  return buildCard(
    makeSource(overrides),
    { kind: "pack", note: "From the test pack.", packName: "test-pack", packVersion: "1.0.0" },
    id,
    createdAt,
  );
}

/** One evidence row, defaulted so a test only states what it cares about. */
export function makeRow(overrides: Partial<EvidenceRow> = {}): EvidenceRow {
  return {
    id: overrides.id ?? `row-${Math.random().toString(36).slice(2, 10)}`,
    cardId: "card:test-1",
    attemptId: "attempt-1",
    region: "b1",
    outcome: "no",
    timeMs: 4200,
    seenBefore: 0,
    at: "2026-10-02T10:00:00.000Z",
    kind: "answer",
    ...overrides,
  };
}

/** Run a job inside a fresh temp folder, then remove it. */
export async function withTempDir(job: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "flashcards-test-"));
  try {
    await job(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Restore an environment name exactly: a missing value means gone, not "undefined". */
function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

/** Point the app's data and pack folders at a temp place for one job. */
export async function withDataDir(job: (dir: string) => Promise<void>): Promise<void> {
  const previous = {
    data: process.env.FLASHCARDS_DATA_DIR,
    packs: process.env.FLASHCARDS_PACKS_DIR,
    url: process.env.FLASHCARDS_PROVIDER_URL,
    model: process.env.FLASHCARDS_PROVIDER_MODEL,
    key: process.env.FLASHCARDS_PROVIDER_KEY,
  };
  await withTempDir(async (dir) => {
    process.env.FLASHCARDS_DATA_DIR = path.join(dir, "data");
    process.env.FLASHCARDS_PACKS_DIR = path.join(dir, "packs");
    try {
      await job(dir);
    } finally {
      setEnv("FLASHCARDS_DATA_DIR", previous.data);
      setEnv("FLASHCARDS_PACKS_DIR", previous.packs);
      setEnv("FLASHCARDS_PROVIDER_URL", previous.url);
      setEnv("FLASHCARDS_PROVIDER_MODEL", previous.model);
      setEnv("FLASHCARDS_PROVIDER_KEY", previous.key);
    }
  });
}

/** The outcomes a test row can take, for table-like loops. */
export const ALL_OUTCOMES: Outcome[] = ["again", "got_it", "nearly", "no", "unjudged"];
