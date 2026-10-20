// WHY: One bundle is create, import and export. This module is the only place
// that decides whether a bundle is valid and what an import is allowed to touch,
// so the three paths cannot drift and a bad file changes nothing.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import semver from "semver";
import { z } from "zod";
import type { Card, CardOrigin, CardSource } from "@/lib/shared/types";
import { buildCard, deckCardId, hardRuleIssues } from "@/lib/core/card";
import {
  cardSourceSchema,
  packPromptsSchema,
  type ValidationIssue,
} from "@/lib/core/schema";
import { normalizeSettings } from "@/lib/core/settings-shape";
import { markChanged, resumeChanges, suspendChanges } from "@/lib/browser/changes";
import {
  clearLibrary,
  readCards,
  readEvidence,
  readMeta,
  readPack,
  readPacks,
  readPromptLog,
  readProviderKey,
  readSessions,
  readSettings,
  patchSettings,
  upsertCards,
  writePack,
  writeProviderKey,
  appendEvidence,
  appendPrompt,
  appendSession,
  clearProviderKey,
  writeMeta,
  type BrowserPack,
} from "@/lib/browser/repository";

/** The one bundle schema. The skill and the app both speak this. */
export const PACK_BUNDLE_SCHEMA = "flashcards.pack/v1";
export const BACKUP_SCHEMA = "flashcards.backup/v1";

/** A deck id is stable, lowercase and safe in a file. */
const deckIdSchema = z
  .string()
  .min(1, "a deck needs an id")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "a deck id uses lowercase letters, numbers and dashes");

/** One deck as it appears inside a bundle. */
export const deckSchema = z.object({
  id: deckIdSchema,
  name: z.string().min(1, "a deck needs a name"),
});

/** A bundle card is a card source plus the deck it belongs to. */
export const bundleCardSchema = cardSourceSchema.omit({ topics: true }).extend({
  deckId: z.string().optional(),
});

/** The pack header inside a bundle. */
export const bundlePackSchema = z.object({
  name: z
    .string()
    .min(1, "a pack needs a name")
    .regex(/^[a-z0-9][a-z0-9-]*$/, "a pack name uses lowercase letters, numbers and dashes"),
  version: z.string().min(1, "a pack needs an author-written version"),
  description: z.string().optional(),
  language: z.string().optional(),
  prompts: packPromptsSchema.optional(),
});

/** The whole pack bundle. */
export const packBundleSchema = z.object({
  schema: z.literal(PACK_BUNDLE_SCHEMA),
  pack: bundlePackSchema,
  decks: z.array(deckSchema),
  cards: z.array(bundleCardSchema),
});

export type PackBundle = z.infer<typeof packBundleSchema>;
export type BundleCard = z.infer<typeof bundleCardSchema>;

/** Where an import is allowed to put its content. */
export type ImportTarget =
  | { kind: "new" }
  | { kind: "pack"; packName: string }
  | { kind: "deck"; packName: string; deckId: string };

/** What an import did, in counts the screen can say out loud. */
export interface ImportSuccess {
  ok: true;
  packName: string;
  decksAdded: number;
  cardsAdded: number;
  duplicates: number;
}

/** An import either happened or named every problem. */
export type ImportResult = ImportSuccess | { ok: false; issues: ValidationIssue[] };

/** One problem in plain words, at the bundle item that caused it. */
function issue(field: string, message: string, index = 0): ValidationIssue {
  return { index, field, message };
}

/** Name the bundle item a schema failure came from, not just the field path. */
function schemaIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((problem) => {
    const parts = problem.path.map((part) => String(part));
    if ((parts[0] === "cards" || parts[0] === "decks") && /^\d+$/.test(parts[1] ?? "")) {
      return {
        index: Number(parts[1]),
        field: parts.slice(2).join(".") || parts[0],
        message: problem.message,
      };
    }
    return { index: 0, field: parts.join(".") || "(bundle)", message: problem.message };
  });
}

/** Read the pasted or loaded text into a parsed bundle. */
export function parseBundle(text: string): { ok: true; bundle: PackBundle } | { ok: false; issues: ValidationIssue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      issues: [
        issue(
          "(bundle)",
          `the text is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
        ),
      ],
    };
  }

  const parsed = packBundleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
  return { ok: true, bundle: parsed.data };
}

/** Compare two author-written versions. Null means they cannot be compared. */
function compareVersions(left: string, right: string): number | null {
  if (left === right) return 0;
  const a = semver.coerce(left);
  const b = semver.coerce(right);
  if (!a || !b) return null;
  return semver.compare(a, b);
}

/** The deck a card names, or a problem. */
function deckFor(
  card: BundleCard,
  index: number,
  decks: Map<string, { id: string; name: string }>,
  fallback: string | null,
): { deck: { id: string; name: string } } | { issues: ValidationIssue[] } {
  const wanted = card.deckId ?? fallback;
  if (!wanted) {
    return { issues: [issue("cards.deckId", "a card must name the deck it belongs to", index)] };
  }
  const deck = decks.get(wanted);
  if (!deck) return { issues: [issue("cards.deckId", `there is no deck "${wanted}" in this pack`, index)] };
  if (fallback && card.deckId && card.deckId !== fallback) {
    return {
      issues: [issue("cards.deckId", `this file adds cards to "${fallback}", not "${card.deckId}"`, index)],
    };
  }
  return { deck };
}

/** Turn one bundle card into the learner's car, or problems with it. */
function cardFromBundle(
  bundleCard: BundleCard,
  index: number,
  deck: { id: string; name: string },
  pack: { name: string; version: string },
  kind: "pack" | "imported",
  now: string,
): { card: Card } | { issues: ValidationIssue[] } {
  const withoutDeck = { ...bundleCard };
  delete withoutDeck.deckId;
  const source: CardSource = { ...withoutDeck, topics: [deck.name] };
  const problems = hardRuleIssues(source, index);
  if (problems.length > 0) return { issues: problems };

  const origin: CardOrigin =
    kind === "imported"
      ? { kind: "imported", note: "Imported by the learner.", packName: pack.name }
      : {
          kind: "pack",
          note: `From the pack ${pack.name}, version ${pack.version}.`,
          packName: pack.name,
          packVersion: pack.version,
        };

  const card = buildCard(source, origin, deckCardId(pack.name, deck.id, source), now);
  card.packName = pack.name;
  card.deckId = deck.id;
  return { card };
}

/**
 * Import a bundle into one of the three targets. Validation runs over the whole
 * file first; a refusal writes nothing.
 */
export async function importBundle(text: string, target: ImportTarget): Promise<ImportResult> {
  const read = parseBundle(text);
  if (!read.ok) return read;
  const bundle = read.bundle;
  const issues: ValidationIssue[] = [];

  const installed = await readPack(bundle.pack.name);
  if ((target.kind === "pack" || target.kind === "deck") && !installed) {
    return { ok: false, issues: [issue("pack.name", `there is no pack "${bundle.pack.name}" here`, 0)] };
  }
  if (target.kind === "pack" && bundle.pack.name !== target.packName) {
    return {
      ok: false,
      issues: [issue("pack.name", `this file is for "${bundle.pack.name}", not "${target.packName}"`, 0)],
    };
  }
  if (target.kind === "deck" && bundle.pack.name !== target.packName) {
    return {
      ok: false,
      issues: [issue("pack.name", `this file is for "${bundle.pack.name}", not "${target.packName}"`, 0)],
    };
  }

  if (installed) {
    const order = compareVersions(bundle.pack.version, installed.version);
    if (order === null) {
      return {
        ok: false,
        issues: [
          issue(
            "pack.version",
            `one of the versions cannot be compared (stored ${installed.version}, file ${bundle.pack.version})`,
            0,
          ),
        ],
      };
    }
    if (order < 0) {
      return {
        ok: false,
        issues: [
          issue(
            "pack.version",
            `the installed pack is version ${installed.version}; this file is older (${bundle.pack.version})`,
            0,
          ),
        ],
      };
    }
  }

  const decks = new Map<string, { id: string; name: string }>();
  if (installed) for (const deck of installed.decks) decks.set(deck.id, deck);
  const decksBefore = decks.size;

  if (target.kind !== "deck" && bundle.decks.length === 0 && !installed) {
    issues.push(issue("decks", "a new pack needs at least one deck", 0));
  }

  for (const [index, deck] of bundle.decks.entries()) {
    if (decks.has(deck.id) && installed && target.kind === "deck") {
      issues.push(issue(`decks.${index}.id`, `"${deck.id}" is already the deck this file targets`, index));
      continue;
    }
    const existing = decks.get(deck.id);
    // WHY: A deck id is the identity; a display name is the learner's label.
    // An import may add a deck but never renames one behind their back.
    if (!existing) decks.set(deck.id, { id: deck.id, name: deck.name });
  }

  if (target.kind === "deck") {
    const deck = decks.get(target.deckId);
    if (!deck) {
      return { ok: false, issues: [issue("deckId", `there is no deck "${target.deckId}" in this pack`, 0)] };
    }
    if (bundle.decks.length > 0) {
      issues.push(issue("decks", "a cards-only file must not add decks; choose the deck it targets", 0));
    }
  }

  const now = new Date().toISOString();
  const fallback = target.kind === "deck" ? target.deckId : null;
  const cards: Card[] = [];
  for (const [index, bundleCard] of bundle.cards.entries()) {
    const found = deckFor(bundleCard, index, decks, fallback);
    if ("issues" in found) {
      issues.push(...found.issues);
      continue;
    }
    const built = cardFromBundle(
      bundleCard,
      index,
      found.deck,
      bundle.pack,
      target.kind === "deck" ? "imported" : "pack",
      now,
    );
    if ("issues" in built) issues.push(...built.issues);
    else cards.push(built.card);
  }

  if (issues.length > 0) return { ok: false, issues };

  const existingCards = await readCards();
  const known = new Set(existingCards.map((card) => card.id));
  const fresh: Card[] = [];
  let duplicates = 0;
  for (const card of cards) {
    // A repeat inside the same file is a duplicate too, not a second card.
    if (known.has(card.id)) {
      duplicates += 1;
      continue;
    }
    known.add(card.id);
    fresh.push(card);
  }

  const existingPack = installed;
  const keepsMetadata = target.kind === "deck";
  const pack: BrowserPack = {
    id: bundle.pack.name,
    name: bundle.pack.name,
    version: keepsMetadata ? (existingPack?.version ?? bundle.pack.version) : bundle.pack.version,
    description: keepsMetadata ? existingPack?.description : bundle.pack.description ?? existingPack?.description,
    language: keepsMetadata ? existingPack?.language : bundle.pack.language ?? existingPack?.language,
    decks: [...decks.values()],
    prompts: keepsMetadata ? (existingPack?.prompts ?? null) : bundle.pack.prompts ?? existingPack?.prompts ?? null,
    createdAt: existingPack?.createdAt ?? now,
    updatedAt: now,
  };
  await writePack(pack);
  if (fresh.length > 0) await upsertCards(fresh);

  return {
    ok: true,
    packName: pack.name,
    decksAdded: Math.max(0, decks.size - decksBefore),
    cardsAdded: fresh.length,
    duplicates,
  };
}

/** A card as it appears inside an exported bundle. */
function cardToBundleCard(card: Card): BundleCard {
  return {
    ...(card.deckId ? { deckId: card.deckId } : {}),
    summary: card.summary,
    tags: card.tags,
    prompt: card.prompt,
    answer: card.answer,
    answerDef: card.answerDef,
    hints: card.hints,
    fullLine: card.fullLine,
  };
}

/** Export one pack as a shareable bundle: content only, never evidence. */
export async function exportPackBundle(name: string): Promise<{ ok: true; json: string } | { ok: false; message: string }> {
  const pack = await readPack(name);
  if (!pack) return { ok: false, message: `There is no pack "${name}" here.` };
  const cards = (await readCards()).filter((card) => card.packName === name && !card.retired);
  const bundle: PackBundle = {
    schema: PACK_BUNDLE_SCHEMA,
    pack: {
      name: pack.name,
      version: pack.version,
      description: pack.description,
      language: pack.language,
      prompts: pack.prompts ?? undefined,
    },
    decks: pack.decks,
    cards: cards.map(cardToBundleCard),
  };
  return { ok: true, json: JSON.stringify(bundle, null, 2) };
}

/** The full backup shape. The provider key is deliberately absent. */
export const backupSchema = z.object({
  schema: z.literal(BACKUP_SCHEMA),
  exportedAt: z.string(),
  packs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string().optional(),
      language: z.string().optional(),
      decks: z.array(deckSchema),
      prompts: packPromptsSchema.nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  cards: z.array(
    cardSourceSchema.extend({
      id: z.string(),
      packName: z.string().optional(),
      deckId: z.string().optional(),
      origin: z.object({
        kind: z.enum(["pack", "learner", "generated", "imported"]),
        note: z.string(),
        packName: z.string().optional(),
        packVersion: z.string().optional(),
        requestId: z.string().optional(),
      }),
      createdAt: z.string(),
      retired: z.boolean().optional(),
      editedFrom: z.string().optional(),
    }),
  ),
  evidence: z.array(
    z.object({
      id: z.string(),
      cardId: z.string(),
      attemptId: z.string(),
      region: z.string().nullable(),
      outcome: z.enum(["again", "got_it", "nearly", "no", "unjudged"]),
      timeMs: z.number(),
      seenBefore: z.number(),
      at: z.string(),
      kind: z.enum(["answer", "correction"]),
      supersedes: z.string().optional(),
    }),
  ),
  sessions: z.array(
    z.object({
      type: z.enum(["started", "ended"]),
      id: z.string(),
      at: z.string(),
      offered: z.number(),
      answered: z.number().optional(),
      completed: z.boolean().optional(),
      stopped: z.boolean().optional(),
    }),
  ),
  settings: z.unknown(),
  prompts: z.array(
    z.object({
      at: z.string(),
      kind: z.enum(["generation", "hint"]),
      requestId: z.string(),
      endpoint: z.string().nullable(),
      model: z.string().nullable(),
      prompt: z.string(),
    }),
  ),
});

/** Export everything the learner owns, but never the key. */
export async function exportBackup(): Promise<string> {
  const [packs, cards, evidence, sessions, settings, prompts] = await Promise.all([
    readPacks(),
    readCards(),
    readEvidence(),
    readSessions(),
    readSettings(),
    readPromptLog(500),
  ]);
  return JSON.stringify(
    {
      schema: BACKUP_SCHEMA,
      exportedAt: new Date().toISOString(),
      packs,
      cards,
      evidence,
      sessions,
      settings,
      prompts,
    },
    null,
    2,
  );
}

/** Restore a backup as a whole. A malformed file changes nothing. */
export async function restoreBackup(text: string): Promise<{ ok: true; packs: number; cards: number } | { ok: false; issues: ValidationIssue[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      issues: [issue("(backup)", `the text is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`)],
    };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };

  const backup = parsed.data;
  const key = await readProviderKey();
  let restored = false;
  suspendChanges();
  try {
    await clearLibrary();

    for (const pack of backup.packs) await writePack(pack as BrowserPack);
    for (const card of backup.cards) {
      const { id, ...source } = card;
      const built = buildCard(source as CardSource, card.origin, id, card.createdAt);
      built.packName = card.packName;
      built.deckId = card.deckId;
      built.retired = card.retired;
      built.editedFrom = card.editedFrom;
      await upsertCards([built]);
    }
    if (backup.evidence.length > 0) await appendEvidence(backup.evidence);
    for (const event of backup.sessions) await appendSession(event);
    for (const entry of backup.prompts) await appendPrompt(entry);
    await patchSettings(normalizeSettings(backup.settings));
    if (key) await writeProviderKey(key);
    else await clearProviderKey();
    await writeMeta("seeded", "yes");
    restored = true;
    return { ok: true, packs: backup.packs.length, cards: backup.cards.length };
  } finally {
    resumeChanges();
    if (restored) markChanged();
  }
}

/** Seed the converted Polish pack once, on a library that has never opened. */
export async function ensureSeeded(): Promise<void> {
  if ((await readMeta("seeded")) === "yes") return;
  if ((await readPacks()).length > 0) {
    await writeMeta("seeded", "yes");
    return;
  }
  try {
    const response = await fetch("/packs/polish-starter.json", { cache: "no-store" });
    if (!response.ok) return;
    const text = await response.text();
    const result = await importBundle(text, { kind: "new" });
    if (result.ok) await writeMeta("seeded", "yes");
  } catch {
    // A missing seed must never stop the app; the learner can import or create.
  }
}
