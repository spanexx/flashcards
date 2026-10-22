// WHY: The hosted build has no server, but every screen already asks URL-shaped
// questions. This router answers those same questions from IndexedDB, so the
// screens keep working while the storage underneath changes. One seam, one error
// shape, no hidden network calls.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-22 opencode: newId replaces randomUUID so card edits and answer rows
// work when a static host is opened over plain HTTP. [pack: library-create-flow]

import type {
  AnswerResult,
  Card,
  CardSource,
  Outcome,
  PackStatus,
  Settings,
  TutorBanner,
} from "@/lib/shared/types";
import { ApiError } from "@/lib/client/errors";
import { newId } from "@/lib/core/id";
import { APP_VERSION } from "@/lib/version";
import {
  buildCard,
  deckCardId,
  hardRuleIssues,
  looksLikeSimpleCard,
  manualCardId,
  simpleCardSchema,
  simpleCardToSource,
} from "@/lib/core/card";
import { cardSourceSchema, issuesFromZod } from "@/lib/core/schema";
import { countSeenBefore, groupAttempts, makeAnswerRows, makeCorrectionRow } from "@/lib/core/evidence";
import { judgeCard } from "@/lib/core/judge";
import { buildPlan } from "@/lib/core/plan";
import { parseCardSources } from "@/lib/core/import";
import { readProgress } from "@/lib/core/progress";
import { describeTutorShape, describeTutorSlots, tutorSlotNames } from "@/lib/provider/prompt";
import {
  appendEvidence,
  appendSession,
  deleteCard,
  deleteCardEvidence,
  deleteDeck,
  deletePack,
  orphanedPackNames,
  packRecord,
  packStatus,
  patchSettings,
  readCards,
  readEvidence,
  readPack,
  readPacks,
  readPromptLog,
  readSessions,
  readSettings,
  recordAlgorithmRun,
  upsertCards,
  type BrowserPack,
} from "@/lib/browser/repository";
import {
  ensureSeeded,
  exportBackup,
  exportPackBundle,
  importBundle,
  restoreBackup,
  PACK_BUNDLE_SCHEMA,
  type ImportTarget,
} from "@/lib/browser/bundle";
import {
  askHint,
  browserProviderStatus,
  generatePrepared,
  prepareGeneration,
  removeProviderKey,
  saveProviderKey,
  testProvider,
  type GenerationTarget,
} from "@/lib/browser/provider";
import { AUTHORING_SKILL_VERSION, buildAuthoringPrompt } from "@/lib/browser/authoring";
import { slugFromName } from "@/lib/browser/creation";

/** One sentence a screen can show without rewriting it. */
function fail(message: string, detail?: unknown): never {
  throw new ApiError(message, detail);
}

/** Read a request body as an object, or refuse it without guessing. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Keep string fields as strings; anything else becomes absent. */
function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Clip a number into a safe range so a bad body cannot skew a timer. */
function asNumber(value: unknown, fallback: number, min = 0, max = 86400000): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Accept only an array of strings; a mixed array is refused whole. */
function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string") ? (value as string[]) : null;
}

/** The library as the old screens knew it: packs, cards and display statuses. */
async function loadState(): Promise<{
  packs: BrowserPack[];
  cards: Card[];
  statuses: PackStatus[];
  orphans: string[];
}> {
  await ensureSeeded();
  const [packs, cards] = await Promise.all([readPacks(), readCards()]);
  const statuses = packs.map((pack) => packStatus(pack, cards));
  return { packs, cards, statuses, orphans: orphanedPackNames(cards, packs) };
}

/** The first pack and deck, used when an older screen has not learned decks yet. */
function firstPlacement(packs: BrowserPack[]): { pack: BrowserPack; deck: BrowserPack["decks"][number] } | null {
  for (const pack of packs) {
    const deck = pack.decks[0];
    if (deck) return { pack, deck };
  }
  return null;
}

/** Merge a partial source over the card it is editing. */
function mergeSource(base: CardSource, patch: Record<string, unknown>): CardSource {
  const merged: CardSource = { ...base };
  if (typeof patch.summary === "string") merged.summary = patch.summary;
  if (Array.isArray(patch.topics)) merged.topics = patch.topics as string[];
  if (Array.isArray(patch.tags)) merged.tags = patch.tags as string[];
  if (Array.isArray(patch.prompt)) merged.prompt = patch.prompt as CardSource["prompt"];
  if (Array.isArray(patch.answer)) merged.answer = patch.answer as CardSource["answer"];
  if (patch.answerDef !== undefined) merged.answerDef = patch.answerDef as CardSource["answerDef"];
  if (Array.isArray(patch.hints)) merged.hints = patch.hints as string[];
  if (typeof patch.fullLine === "string") merged.fullLine = patch.fullLine;
  return merged;
}

async function cardsAnswer(): Promise<{ cards: Card[]; orphans: string[] }> {
  const state = await loadState();
  return { cards: state.cards, orphans: state.orphans };
}

async function packsAnswer(): Promise<{ packs: PackStatus[]; orphans: string[]; folder: string }> {
  const state = await loadState();
  return { packs: state.statuses, orphans: state.orphans, folder: "This browser (IndexedDB)" };
}

/** Build the plan exactly as the old route did, but from browser data. */
async function planAnswer(offerRaw: number | undefined) {
  const state = await loadState();
  const active = state.cards.filter((card) => !card.retired);
  if (active.length === 0) {
    return { plan: null, message: "No cards yet. Create a pack, or import a bundle in the library." };
  }

  const [rows, events] = await Promise.all([readEvidence(), readSessions()]);
  let settings = await readSettings();
  const result = buildPlan(
    {
      cards: state.cards,
      rows,
      events,
      topicLabels: {},
      now: new Date(),
      offer: offerRaw,
    },
    settings.algorithm.fallbackCount,
  );

  const now = new Date().toISOString();
  if (result.usedFallback) settings = await recordAlgorithmRun("fallback", now);
  else if (settings.algorithm.lastAlgorithm !== "default") settings = await recordAlgorithmRun("default", now);
  result.plan.fallbackCount = settings.algorithm.fallbackCount;

  const first = result.plan.cards[0];
  const pack =
    (first?.packName ? state.packs.find((entry) => entry.name === first.packName) : null) ??
    state.packs[0] ??
    null;
  const status = await browserProviderStatus();

  let banner: TutorBanner | null = null;
  if (status.configured && status.hasKey && pack) {
    const record = packRecord(pack);
    const names = tutorSlotNames(record);
    banner = {
      available: true,
      model: status.model,
      endpoint: status.endpoint,
      seesCardText: names.includes("cardText"),
      seesOutcomeCategory: names.includes("outcomeCategory"),
      seesLearnerText: false,
      slots: describeTutorSlots(record),
      shape: describeTutorShape(record),
    };
  }
  result.plan.banner = banner;

  await appendSession({
    type: "started",
    id: result.plan.sessionId,
    at: now,
    offered: result.plan.offer,
  });

  return { plan: result.plan, message: null };
}

async function answer(body: Record<string, unknown>): Promise<AnswerResult> {
  const cardId = asString(body.cardId);
  if (!cardId) fail("An answer needs to say which card it belongs to.");
  const cards = await readCards();
  const card = cards.find((entry) => entry.id === cardId);
  if (!card) fail("That card is not in the deck.");

  const rawAnswers = asRecord(body.answers) ?? {};
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (typeof value === "string") answers[key] = value;
  }

  const attemptId = asString(body.attemptId) ?? newId();
  const timeMs = asNumber(body.timeMs, 0, 0, 24 * 60 * 60 * 1000);
  const hintUsed = body.hintUsed === true;

  const rows = await readEvidence();
  const seenBefore = countSeenBefore(rows, cardId);
  const judged = judgeCard(card.answerDef, answers, seenBefore, hintUsed);
  const at = new Date().toISOString();
  const newRows = makeAnswerRows(cardId, attemptId, judged.results, timeMs, seenBefore, at);
  await appendEvidence(newRows);

  return {
    cardId,
    attemptId,
    results: judged.results,
    cardOutcome: judged.cardOutcome,
    capped: judged.capped,
    judge: judged.judge,
    rows: newRows,
  };
}

/** Find one deck by its pack and deck ids, never by deck id alone. */
function findDeck(
  packs: BrowserPack[],
  packName: string | null | undefined,
  deckId: string | null | undefined,
): { pack: BrowserPack; deck: BrowserPack["decks"][number] } | null {
  if (!packName || !deckId) return null;
  const pack = packs.find((entry) => entry.name === packName);
  const deck = pack?.decks.find((entry) => entry.id === deckId);
  return pack && deck ? { pack, deck } : null;
}

/** Create a pack and its first deck through the one bundle validator. */
async function createPack(body: Record<string, unknown>) {
  const name = slugFromName(asString(body.name)?.trim() || "", "");
  if (!name) fail("Give the pack a name.");
  if (await readPack(name)) fail(`A pack named "${name}" is already here.`);
  const version = asString(body.version)?.trim() || "1.0.0";
  const deckName = asString(body.deckName)?.trim() || "Basics";
  const deckId = asString(body.deckId)?.trim() || slugFromName(deckName, "deck");
  const bundle = {
    schema: PACK_BUNDLE_SCHEMA,
    pack: {
      name,
      version,
      description: asString(body.description)?.trim() || undefined,
      language: asString(body.language)?.trim() || undefined,
    },
    decks: [{ id: deckId, name: deckName }],
    cards: [],
  };
  const result = await importBundle(JSON.stringify(bundle), { kind: "pack" });
  if (!result.ok) fail("The pack needs fixing before it can be saved.", result.issues);
  const pack = await readPack(name);
  return { pack };
}

/** Add one deck to an existing pack. The learner writes the label, not the id. */
async function createDeck(packName: string, body: Record<string, unknown>) {
  const pack = await readPack(packName);
  if (!pack) fail(`There is no pack "${packName}" here.`);
  const name = asString(body.name)?.trim();
  if (!name) fail("Give the deck a name.");
  const id = asString(body.id)?.trim() || slugFromName(name, "deck");
  const fragment = { decks: [{ id, name }], cards: [] };
  const result = await importBundle(JSON.stringify(fragment), { kind: "deck", packName });
  if (!result.ok) fail("The deck needs fixing before it can be saved.", result.issues);
  const fresh = await readPack(packName);
  const deck = fresh?.decks.find((entry) => entry.id === result.deckIds[0]) ?? null;
  return { pack: fresh, deck };
}

/** Add one card to a chosen deck. A deck is found by its pack and id together. */
async function createCard(body: Record<string, unknown>) {
  const state = await loadState();
  const wantedPack = asString(body.packName);
  const wantedDeck = asString(body.deckId);
  const chosen = findDeck(state.packs, wantedPack, wantedDeck);
  if (!chosen) {
    if (wantedPack || wantedDeck) {
      fail(
        wantedPack
          ? `That deck is not in "${wantedPack}".`
          : "Choose the pack and deck this card belongs to.",
      );
    }
    const place = firstPlacement(state.packs);
    if (!place) fail("There is no deck to put this card in. Create a pack first.");
    return createCardIn(place.pack, place.deck, body);
  }
  return createCardIn(chosen.pack, chosen.deck, body);
}

/** The write half of a manual card, after the pack and deck are known. */
async function createCardIn(
  pack: BrowserPack,
  deck: BrowserPack["decks"][number],
  body: Record<string, unknown>,
) {
  const payload: Record<string, unknown> = { ...body, topics: [deck.name] };
  let source: CardSource;
  if (looksLikeSimpleCard(payload)) {
    const simple = simpleCardSchema.safeParse(payload);
    if (!simple.success) fail("The card is missing something.", issuesFromZod(simple.error, 0));
    source = simpleCardToSource(simple.data);
  } else {
    const parsed = cardSourceSchema.safeParse(payload);
    if (!parsed.success) fail("The card is missing something.", issuesFromZod(parsed.error, 0));
    source = parsed.data;
  }

  source.topics = [deck.name];
  const issues = hardRuleIssues(source);
  if (issues.length > 0) fail("The card did not pass its checks.", issues);

  const now = new Date().toISOString();
  const card = buildCard(
    source,
    { kind: "learner", note: "Written by the learner." },
    deckCardId(pack.name, deck.id, source),
    now,
  );
  card.packName = pack.name;
  card.deckId = deck.id;
  const existing = (await readCards()).find((entry) => entry.id === card.id && !entry.retired);
  if (existing) fail("That card is already in this deck.");
  await upsertCards([card]);
  return { card };
}

/** Edit makes a new card and retires the old one, so evidence stays honest. */
async function editCard(id: string, body: Record<string, unknown>) {
  const cards = await readCards();
  const existingCard = cards.find((entry) => entry.id === id);
  if (!existingCard) fail("That card is not in the deck.");

  const base: CardSource = {
    summary: existingCard.summary,
    topics: existingCard.topics,
    tags: existingCard.tags,
    prompt: existingCard.prompt,
    answer: existingCard.answer,
    answerDef: existingCard.answerDef,
    hints: existingCard.hints,
    fullLine: existingCard.fullLine,
  };

  let source: CardSource;
  if (looksLikeSimpleCard(body)) {
    const payload = { ...body, topics: existingCard.topics };
    const simple = simpleCardSchema.safeParse(payload);
    if (!simple.success) fail("The card is missing something.", issuesFromZod(simple.error, 0));
    source = simpleCardToSource(simple.data);
  } else {
    source = mergeSource(base, body);
    const parsed = cardSourceSchema.safeParse(source);
    if (!parsed.success) fail("The card is missing something.", issuesFromZod(parsed.error, 0));
    source = parsed.data;
  }

  const pack = existingCard.packName ? await readPack(existingCard.packName) : null;
  const deck = pack?.decks.find((entry) => entry.id === existingCard.deckId) ?? pack?.decks[0] ?? null;
  if (deck) source.topics = [deck.name];

  const issues = hardRuleIssues(source);
  if (issues.length > 0) fail("The card did not pass its checks.", issues);

  const now = new Date().toISOString();
  const card = buildCard(
    source,
    {
      kind: "learner",
      note: `Written by the learner, editing a card that came from ${existingCard.origin.kind}.`,
      packName: existingCard.origin.packName,
    },
    manualCardId(newId()),
    now,
  );
  card.editedFrom = existingCard.id;
  card.packName = existingCard.packName;
  card.deckId = existingCard.deckId;

  await upsertCards([{ ...existingCard, retired: true }, card]);
  return { card, retired: existingCard.id };
}

/** The old flat import is wrapped in the one bundle format, targeting one deck. */
async function importFlatCards(body: Record<string, unknown>) {
  const text = asString(body.json);
  if (!text || text.trim().length === 0) fail("Paste the cards as JSON before importing.");
  const read = parseCardSources(text, "imported");
  if (!read.ok) fail("Nothing was imported, because some cards need fixing.", read.issues);

  const state = await loadState();
  const wantedPack = asString(body.packName);
  const wantedDeck = asString(body.deckId);
  const chosen = findDeck(state.packs, wantedPack, wantedDeck);
  if (!chosen) {
    if (wantedPack || wantedDeck) {
      fail(
        wantedPack
          ? `That deck is not in "${wantedPack}".`
          : "Choose the pack and deck these cards belong to.",
      );
    }
    const place = firstPlacement(state.packs);
    if (!place) fail("There is no deck to import into. Create a pack first.");
    return importFlatInto(place.pack, place.deck, read.sources);
  }
  return importFlatInto(chosen.pack, chosen.deck, read.sources);
}

/** The write half of a flat import, after the pack and deck are known. */
async function importFlatInto(
  pack: BrowserPack,
  deck: BrowserPack["decks"][number],
  sources: CardSource[],
) {
  const bundle = {
    cards: sources.map((source) => ({ ...source, deckId: deck.id })),
  };
  const result = await importBundle(JSON.stringify(bundle), {
    kind: "cards",
    packName: pack.name,
    deckId: deck.id,
  });
  if (!result.ok) fail("Nothing was imported, because some cards need fixing.", result.issues);
  return { imported: result.cardsAdded, duplicates: result.duplicates, cards: (await readCards()).filter((card) => !card.retired) };
}

async function updateSettings(body: Record<string, unknown>) {
  const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
  const STYLES = new Set(["examples-first", "rules-first", "conversation", "gentle"]);
  const patch: Partial<Settings> = {};
  if (typeof body.level === "string") {
    if (!LEVELS.has(body.level)) fail("That is not a level the app knows.");
    patch.level = body.level as Settings["level"];
  }
  if (typeof body.learningStyle === "string") {
    if (!STYLES.has(body.learningStyle)) fail("That is not a learning style the app knows.");
    patch.learningStyle = body.learningStyle as Settings["learningStyle"];
  }
  const provider = asRecord(body.provider);
  if (provider) {
    const current = await readSettings();
    patch.provider = {
      url: typeof provider.url === "string" ? provider.url.trim() : current.provider.url,
      model: typeof provider.model === "string" ? provider.model.trim() : current.provider.model,
    };
  }
  const settings = await patchSettings(patch);
  return { settings, provider: await browserProviderStatus() };
}

/** Read something. Every read waits for the one-time seed. */
export async function localGet<T>(url: string): Promise<T> {
  const parsed = new URL(url, "http://flashcards.local");
  const path = parsed.pathname;
  const query = parsed.searchParams;

  if (path === "/api/health") return { ok: true, version: APP_VERSION } as T;
  if (path === "/api/packs") return (await packsAnswer()) as T;
  if (path === "/api/cards") return (await cardsAnswer()) as T;
  if (path === "/api/plan") {
    const raw = Number(query.get("offer"));
    const offer = Number.isFinite(raw) && raw >= 1 ? Math.min(200, Math.floor(raw)) : undefined;
    return (await planAnswer(offer)) as T;
  }
  if (path === "/api/progress") {
    const state = await loadState();
    const rows = await readEvidence();
    return { progress: readProgress(state.cards, rows, {}) } as T;
  }
  if (path === "/api/evidence") {
    const cardId = query.get("cardId");
    if (!cardId) fail("The evidence drawer needs a card id.");
    const state = await loadState();
    const card = state.cards.find((entry) => entry.id === cardId);
    if (!card) fail("That card is not in the deck.");
    const rows = (await readEvidence()).filter((row) => row.cardId === cardId);
    return { card, rows, attempts: groupAttempts(rows, cardId) } as T;
  }
  if (path === "/api/prompts") {
    const limit = Number(query.get("limit"));
    return { entries: await readPromptLog(Number.isFinite(limit) && limit > 0 ? Math.min(500, limit) : 50) } as T;
  }
  if (path === "/api/settings") {
    return {
      settings: await readSettings(),
      provider: await browserProviderStatus(),
      folders: { data: "This browser (IndexedDB)", packs: "This browser (IndexedDB)" },
      version: APP_VERSION,
    } as T;
  }
  if (path === "/api/packs/export") {
    const name = query.get("name");
    if (!name) fail("Choose a pack to export.");
    const result = await exportPackBundle(name);
    if (!result.ok) fail(result.message);
    return { json: result.json } as T;
  }
  if (path === "/api/backup/export") {
    return { json: await exportBackup() } as T;
  }

  fail(`The app does not know how to read ${path}.`);
}

/** Change something. Every write is local and final before it answers. */
export async function localSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const parsed = new URL(url, "http://flashcards.local");
  const path = parsed.pathname;
  const record = asRecord(body);

  if (path === "/api/packs/rescan") return (await packsAnswer()) as T;
  if (path === "/api/packs/import") {
    const text = record ? asString(record.json) : null;
    if (!text) fail("Paste the bundle as JSON before importing.");
    const targetRecord = asRecord(record?.target);
    const kind = targetRecord ? asString(targetRecord.kind) : null;
    let target: ImportTarget;
    if (kind === "pack") {
      target = { kind: "pack" };
    } else if (kind === "deck") {
      const packName = asString(targetRecord?.packName);
      if (!packName) fail("Choose the pack these decks should join.");
      target = { kind: "deck", packName };
    } else if (kind === "cards") {
      const packName = asString(targetRecord?.packName);
      const deckId = asString(targetRecord?.deckId);
      if (!packName || !deckId) fail("Choose the pack and deck these cards should join.");
      target = { kind: "cards", packName, deckId };
    } else {
      fail("Choose Pack, Deck or Cards as the target.");
    }
    const rawPolicy = asString(record?.namePolicy);
    if (rawPolicy && rawPolicy !== "strict" && rawPolicy !== "auto-suffix") {
      fail("That name policy is not one the app knows.");
    }
    const namePolicy = rawPolicy === "auto-suffix" ? "auto-suffix" : "strict";
    const result = await importBundle(text, target, { namePolicy });
    if (!result.ok) fail("Nothing was imported, because the file needs fixing.", result.issues);
    return result as T;
  }
  if (path === "/api/backup/restore") {
    const text = record ? asString(record.json) : null;
    if (!text) fail("Paste the backup as JSON before restoring.");
    const result = await restoreBackup(text);
    if (!result.ok) fail("Nothing was restored, because the backup needs fixing.", result.issues);
    return result as T;
  }
  if (path === "/api/packs" && method === "POST") {
    if (!record) fail("The pack arrived in a shape the app does not understand.");
    return (await createPack(record)) as T;
  }
  const packPath = /^\/api\/packs\/([^/]+)$/.exec(path);
  if (packPath && method === "DELETE") {
    const name = decodeURIComponent(packPath[1]);
    const result = await deletePack(name);
    if (!result) fail(`There is no pack "${name}" here.`);
    return { deleted: true, ...result } as T;
  }
  const deckPath = /^\/api\/packs\/([^/]+)\/decks(?:\/([^/]+))?$/.exec(path);
  if (deckPath && method === "POST" && !deckPath[2]) {
    if (!record) fail("The deck arrived in a shape the app does not understand.");
    return (await createDeck(decodeURIComponent(deckPath[1]), record)) as T;
  }
  if (deckPath && method === "DELETE" && deckPath[2]) {
    const packName = decodeURIComponent(deckPath[1]);
    const deckId = decodeURIComponent(deckPath[2]);
    const result = await deleteDeck(packName, deckId);
    if (!result.ok) {
      if (result.reason === "last-deck") fail("A pack must keep at least one deck. Delete the pack instead.");
      if (result.reason === "missing-pack") fail(`There is no pack "${packName}" here.`);
      fail(`There is no deck "${deckId}" in "${packName}".`);
    }
    return { deleted: true, ...result } as T;
  }
  if (path === "/api/cards") {
    if (!record) fail("The card arrived in a shape the app does not understand.");
    if (method === "POST") return (await createCard(record)) as T;
  }
  if (path.startsWith("/api/cards/") && path !== "/api/cards/import") {
    const id = decodeURIComponent(path.slice("/api/cards/".length));
    if (method === "PATCH") {
      if (!record) fail("The edit arrived in a shape the app does not understand.");
      return (await editCard(id, record)) as T;
    }
    if (method === "DELETE") {
      const cards = await readCards();
      const existing = cards.find((entry) => entry.id === id);
      if (!existing) fail("That card is not in the deck.");
      await deleteCard(id);
      const removedEvidenceRows = await deleteCardEvidence(id);
      return { deleted: true, removedEvidenceRows } as T;
    }
  }
  if (path === "/api/cards/import") {
    if (!record) fail("The import arrived in a shape the app does not understand.");
    return (await importFlatCards(record)) as T;
  }
  if (path === "/api/answer") {
    if (!record) fail("The answer arrived in a shape the app does not understand.");
    return (await answer(record)) as T;
  }
  if (path === "/api/session/end") {
    if (!record) fail("The session end arrived in a shape the app does not understand.");
    const sessionId = asString(record.sessionId);
    if (!sessionId) fail("A finished session needs its id.");
    const event = {
      type: "ended" as const,
      id: sessionId,
      at: new Date().toISOString(),
      offered: asNumber(record.offered, 0, 0, 1000),
      answered: asNumber(record.answered, 0, 0, 1000),
      completed: record.completed === true,
      stopped: record.stopped === true,
    };
    await appendSession(event);
    return { ok: true, event } as T;
  }
  if (path === "/api/evidence/correction") {
    if (!record) fail("The correction arrived in a shape the app does not understand.");
    const rowId = asString(record.rowId);
    const outcome = asString(record.outcome) as Outcome | null;
    const correctable = new Set<Outcome>(["again", "got_it", "nearly", "no"]);
    if (!rowId) fail("A correction needs to say which answer it is about.");
    if (!outcome || !correctable.has(outcome)) fail("A correction must pick one of: got it, nearly, again, no.");
    const rows = await readEvidence();
    const original = rows.find((row) => row.id === rowId);
    if (!original) fail("That answer row is not in the record.");
    const correction = makeCorrectionRow(original, outcome, new Date().toISOString());
    await appendEvidence([correction]);
    return { correction } as T;
  }
  if (path === "/api/settings" && method === "PATCH") {
    if (!record) fail("The change arrived in a shape the app does not understand.");
    return (await updateSettings(record)) as T;
  }
  if (path === "/api/provider/key" && method === "POST") {
    const key = record ? asString(record.key) : null;
    if (key === null) fail("A key is needed, or an empty value to clear it.");
    const result = await saveProviderKey(key);
    return { ...result, keyStore: result.hasKey ? "browser" : "none" } as T;
  }
  if (path === "/api/provider/key" && method === "DELETE") {
    const result = await removeProviderKey();
    return { ...result, keyStore: "none" } as T;
  }
  if (path === "/api/provider/test") return (await testProvider()) as T;
  if (path === "/api/provider/prepare") {
    if (!record) fail("The request arrived in a shape the app does not understand.");
    const targetRecord = asRecord(record.target);
    const kind = targetRecord ? asString(targetRecord.kind) : null;
    let target: GenerationTarget;
    if (kind === "pack") {
      target = { kind: "pack" };
    } else if (kind === "deck") {
      const packName = asString(targetRecord?.packName);
      if (!packName) fail("Choose the pack the provider should add a deck to.");
      target = { kind: "deck", packName };
    } else if (kind === "cards") {
      const packName = asString(targetRecord?.packName);
      const deckId = asString(targetRecord?.deckId);
      if (!packName || !deckId) fail("Choose the pack and deck the provider should add cards to.");
      target = { kind: "cards", packName, deckId };
    } else {
      fail("Choose Pack, Deck or Cards as the target.");
    }
    const prepared = await prepareGeneration({
      target,
      count: asNumber(record.count, kind === "pack" ? 10 : 5, 1, 20),
    });
    const settings = await readSettings();
    return {
      ...prepared,
      weakTopics: [],
      level: settings.level,
      learningStyle: settings.learningStyle,
    } as T;
  }
  if (path === "/api/provider/generate") {
    const requestId = record ? asString(record.requestId) : null;
    if (!requestId) fail("A prepared prompt id is needed.");
    return (await generatePrepared(requestId)) as T;
  }
  if (path === "/api/provider/hint") {
    if (!record) fail("The hint request arrived in a shape the app does not understand.");
    const cardId = asString(record.cardId);
    if (!cardId) fail("A hint needs to know which card it is for.");
    return (await askHint({
      cardId,
      approved: record.approved === true,
      usedHints: asStringArray(record.usedHints) ?? [],
      outcomeCategory: asString(record.outcomeCategory) ?? "not answered yet",
    })) as T;
  }
  if (path === "/api/authoring/prompt") {
    const target = record ? asRecord(record.target) : null;
    if (!target) fail("Choose what the chat should write for.");
    const kind = asString(target.kind);
    const packName = asString(target.packName);
    const deckId = asString(target.deckId);
    if (kind === "pack") {
      return { prompt: buildAuthoringPrompt({ kind: "pack" }), version: AUTHORING_SKILL_VERSION } as T;
    }
    if (kind === "deck") {
      if (!packName) fail("Choose the pack the chat should add a deck to.");
      const pack = await readPack(packName);
      if (!pack) fail(`There is no pack "${packName}" here.`);
      return { prompt: buildAuthoringPrompt({ kind: "deck", packName }, pack), version: AUTHORING_SKILL_VERSION } as T;
    }
    if (kind === "cards") {
      if (!packName || !deckId) fail("Choose the pack and deck the chat should add cards to.");
      const pack = await readPack(packName);
      if (!pack) fail(`There is no pack "${packName}" here.`);
      return { prompt: buildAuthoringPrompt({ kind: "cards", packName, deckId }, pack), version: AUTHORING_SKILL_VERSION } as T;
    }
    fail("Choose Pack, Deck or Cards as the chat target.");
  }

  fail(`The app does not know how to change ${path}.`);
}
