// WHY: In the hosted build the browser is the only thing that talks to the
// provider. This module keeps that call honest: the key stays in IndexedDB, the
// prompt is shown before it leaves, and every outbound prompt is logged locally.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-22 opencode: the learner's brief reaches every generation prompt, and
// the requested style and pack language reach the generated card builder.
// [pack: creation-control]
// 2026-10-23 opencode: a generation can run from a stored prepared request, and
// a timeout is marked for the background job retry. [pack: background-jobs]
// 2026-10-27 qoder: cards inside a deck are asked at that deck's level, and a
// generated deck is stored at the level the request was prepared with. [D-29]
// 2026-10-27 opencode: the one no-key refusal is exported for the progress
// summary and import repair paths. [pack: progress-summary, import-repair]
// 2026-10-28 qoder: the own-provider config carries the relay address and a
// remembered host, and the card names the road. [pack: provider-relay]

import type { Card, ProviderStatus } from "@/lib/shared/types";
import { ProviderTimeoutError } from "@/lib/provider/client";
import { callBrowserProvider } from "@/lib/browser/provider-call";
import {
  generatedCardsBundle,
  generatedDeckBundle,
  generatedPackBundle,
} from "@/lib/provider/generate";
import { pickPackHint, requestTutorHint } from "@/lib/provider/hint";
import { holdPrepared, takePrepared, type PreparedRequest } from "@/lib/provider/prepare";
import {
  buildDeckGenerationPrompt,
  buildGenerationPrompt,
  buildPackGenerationPrompt,
  type ProfileSlots,
} from "@/lib/provider/prompt";
import type { ProviderConfig } from "@/lib/provider/types";
import { deriveWeakTopics } from "@/lib/core/progress";
import { providerHost } from "@/lib/core/settings-shape";
import {
  libraryInventoryFromPacks,
  type CreationBrief,
} from "@/lib/shared/creation";
import {
  appendPrompt,
  readCards,
  readEvidence,
  readPack,
  readPacks,
  readProviderKey,
  readSettings,
  readSystemLicense,
  writeProviderKey,
  clearProviderKey,
  packRecord,
  type BrowserPack,
} from "@/lib/browser/repository";
import { importBundle } from "@/lib/browser/bundle";
import { systemApiBase, systemChatBase } from "@/lib/client/system";

/** No key, no call. This is the one refusal every provider feature shares. */
export async function providerConfig(): Promise<
  { ok: true; config: ProviderConfig } | { ok: false; message: string }
> {
  const settings = await readSettings();
  // WHY: The paid lane replaces the learner's address and key with the
  // subscription service and the pass this browser keeps. A pass is not the
  // operator's key: the service never sends that key to the page.
  if (settings.provider.mode === "system") {
    const base = systemApiBase();
    if (base.length === 0) {
      return { ok: false, message: "This build has no system provider address. Use your own provider." };
    }
    const license = await readSystemLicense();
    if (!license) {
      return { ok: false, message: "The system provider needs a subscription. Open settings and subscribe." };
    }
    return {
      ok: true,
      config: { url: systemChatBase(base), model: "system", key: license.license, swappedForWsl: false },
    };
  }

  const url = settings.provider.url.trim();
  const model = settings.provider.model.trim();
  if (url.length === 0 || model.length === 0) {
    return { ok: false, message: "No provider is set up. The app works without one." };
  }
  const key = await readProviderKey();
  if (!key) {
    return { ok: false, message: "A provider is set up but no key is stored. Add a key in settings." };
  }
  const config: ProviderConfig = { url, model, key, swappedForWsl: false };
  const relayBase = systemApiBase();
  if (relayBase.length > 0) config.relayBase = relayBase;
  const host = providerHost(url);
  if (host && (settings.provider.relayHosts ?? []).includes(host)) config.preferRelay = true;
  return { ok: true, config };
}

/** Provider state in plain words; the key itself is never returned. */
export async function browserProviderStatus(): Promise<ProviderStatus> {
  const settings = await readSettings();
  if (settings.provider.mode === "system") {
    const enabled = systemApiBase().length > 0;
    const license = await readSystemLicense();
    return {
      configured: enabled,
      hasKey: license !== null,
      endpoint: enabled ? systemChatBase() : null,
      model: enabled ? "system" : null,
      keyStore: license ? "browser" : "none",
      swappedForWsl: false,
      mode: "system",
      message: !enabled
        ? "This build has no system provider address. Use your own provider."
        : license
          ? "The system provider answers through your subscription. No key is stored."
          : "The system provider needs a subscription. Subscribe in settings.",
    };
  }

  const key = await readProviderKey();
  const configured = settings.provider.url.trim().length > 0 && settings.provider.model.trim().length > 0;
  const host = providerHost(settings.provider.url.trim());
  const relayAvailable = systemApiBase().length > 0;
  const relay = relayAvailable && host !== null && (settings.provider.relayHosts ?? []).includes(host);
  let message = relayAvailable
    ? "The browser calls the provider directly. If your provider refuses browser calls, the relay is tried automatically."
    : "The browser calls the provider directly. Some providers refuse browser calls (CORS).";
  if (!configured) message = "No provider is set up. The app works without one.";
  else if (!key) message = "A provider is set up but no key is stored. Add a key in settings.";
  else if (relay) {
    message =
      "This provider refused calls from the browser, so calls go through the relay. The key is sent with each call and is not stored there.";
  }
  return {
    configured,
    hasKey: key.length > 0,
    endpoint: settings.provider.url.trim() || null,
    model: settings.provider.model.trim() || null,
    keyStore: key.length > 0 ? "browser" : "none",
    swappedForWsl: false,
    mode: "custom",
    relay,
    message,
  };
}

/** Store or replace the key in this browser. */
export async function saveProviderKey(key: string): Promise<{ name: string; hasKey: boolean }> {
  if (key.trim().length === 0) {
    await clearProviderKey();
    return { name: "this browser", hasKey: false };
  }
  await writeProviderKey(key.trim());
  return { name: "this browser", hasKey: true };
}

/** Remove the key from this browser. */
export async function removeProviderKey(): Promise<{ name: string; hasKey: boolean }> {
  await clearProviderKey();
  return { name: "this browser", hasKey: false };
}

/** The learner's three categories plus the weak topics the planner can see. */
async function profileSlots(cards: Card[]): Promise<ProfileSlots> {
  const [settings, rows] = await Promise.all([readSettings(), readEvidence()]);
  return {
    weakTopics: deriveWeakTopics(cards, rows),
    level: settings.level,
    learningStyle: settings.learningStyle,
  };
}

/** One plain sentence after a test call. No learner content is sent. */
export async function testProvider(): Promise<{
  ok: boolean;
  message: string;
  via?: "direct" | "relay";
}> {
  const config = await providerConfig();
  if (!config.ok) return { ok: false, message: config.message };
  // A test always tries the direct road first, even for a remembered host; the
  // wrapper then clears or keeps the memory based on what actually answered.
  const result = await callBrowserProvider(
    { ...config.config, preferRelay: false },
    [
      { role: "system", content: "You are a connection test. Answer with the single word OK." },
      { role: "user", content: "Say OK." },
    ],
    { timeoutMs: 20000 },
  );
  if (!result.ok) return { ok: false, message: result.message };
  const via = result.via === "relay" ? "relay" : "direct";
  return {
    ok: true,
    via,
    message:
      via === "relay"
        ? "The provider answered through the relay. It is ready to use."
        : "The provider answered directly. It is ready to use.",
  };
}

/** The three places a provider batch may land. */
export type GenerationTarget =
  | { kind: "pack" }
  | { kind: "deck"; packName: string }
  | { kind: "cards"; packName: string; deckId: string };

/** What one provider batch made, in the shape the Create screen navigates with. */
export interface GenerationResult {
  kind: "pack" | "deck" | "cards";
  packName: string;
  deckId?: string;
  count: number;
  cards: Card[];
  pack?: BrowserPack | null;
}

/** Keep the learner's count inside the range the provider prompt promises. */
function generationCount(value: number | undefined, fallback: number): number {
  return Math.min(20, Math.max(1, Math.floor(value ?? fallback)));
}

/** Build a generation prompt and hold it until the learner presses send. */
export async function prepareGeneration(body: {
  target?: GenerationTarget;
  count?: number;
  brief?: CreationBrief;
}): Promise<{ requestId: string; prompt: string; expiresAt: number }> {
  const target = body.target;
  if (!target) throw new Error("Choose what the provider should make.");
  const cards = await readCards();
  const slots = await profileSlots(cards);
  // The prompt may name the library, so it is read once in the allowed shape.
  const packs = await readPacks();
  const inventory = libraryInventoryFromPacks(packs);

  if (target.kind === "pack") {
    const count = generationCount(body.count, 10);
    const prompt = buildPackGenerationPrompt(slots, count, {
      brief: body.brief,
      inventory,
    });
    const prepared = holdPrepared({
      kind: "generation",
      display: prompt.display,
      messages: prompt.messages,
      targetKind: "pack",
      packName: null,
      topic: null,
      deckId: null,
      count,
      cardId: null,
      brief: body.brief,
      level: slots.level,
    });
    return { requestId: prepared.id, prompt: prompt.display, expiresAt: prepared.expiresAt };
  }

  const pack = packs.find((entry) => entry.name === target.packName) ?? null;
  if (!pack) throw new Error("That pack is not here.");

  if (target.kind === "deck") {
    const count = generationCount(body.count, 5);
    const prompt = buildDeckGenerationPrompt(packRecord(pack), slots, count, {
      brief: body.brief,
      inventory,
    });
    const prepared = holdPrepared({
      kind: "generation",
      display: prompt.display,
      messages: prompt.messages,
      targetKind: "deck",
      packName: pack.name,
      topic: null,
      deckId: null,
      count,
      cardId: null,
      brief: body.brief,
      level: slots.level,
    });
    return { requestId: prepared.id, prompt: prompt.display, expiresAt: prepared.expiresAt };
  }

  const wantedDeck = target.deckId;
  const deck = pack.decks.find((entry) => entry.id === wantedDeck);
  if (!deck) throw new Error(`That deck is not in ${pack.name}.`);
  const count = generationCount(body.count, 5);
  // WHY: A deck's level wins for generation inside that deck; the global learner
  // level is only the fallback when no deck is chosen. [D-29]
  const prompt = buildGenerationPrompt(
    packRecord(pack),
    { ...slots, level: deck.level },
    {
      topic: deck.name,
      count,
      brief: body.brief,
      inventory,
    },
  );
  const prepared = holdPrepared({
    kind: "generation",
    display: prompt.display,
    messages: prompt.messages,
    targetKind: "cards",
    packName: pack.name,
    topic: deck.name,
    deckId: deck.id,
    count,
    cardId: null,
    brief: body.brief,
    level: deck.level,
  });
  return { requestId: prepared.id, prompt: prompt.display, expiresAt: prepared.expiresAt };
}

function importFailure(issues: Array<{ field: string; message: string }>): Error {
  const first = issues[0];
  return new Error(
    `Nothing was saved, because ${first ? `${first.field}: ${first.message}` : "the provider's answer was not usable"}.`,
  );
}

/**
 * Send a held generation prompt. The synchronous route takes an id; a job
 * already owns the prepared request, so both paths share the body below.
 */
export async function generatePrepared(requestId: string): Promise<GenerationResult> {
  if (!requestId) throw new Error("A prepared prompt id is needed.");
  const prepared = takePrepared(requestId);
  if (!prepared || prepared.kind !== "generation") {
    throw new Error("That prepared prompt has expired. Prepare it again.");
  }
  return generateFromPrepared(prepared);
}

/** Send one prepared generation prompt and keep the whole batch only if it is valid. */
export async function generateFromPrepared(prepared: PreparedRequest): Promise<GenerationResult> {
  if (prepared.kind !== "generation") {
    throw new Error("That prepared prompt is not a generation request.");
  }
  const config = await providerConfig();
  if (!config.ok) throw new Error(config.message);

  const result = await callBrowserProvider(config.config, prepared.messages, { timeoutMs: 60000 });
  await appendPrompt({
    at: new Date().toISOString(),
    kind: "generation",
    requestId: prepared.id,
    endpoint: config.config.url,
    model: config.config.model,
    prompt: prepared.display,
  });
  if (!result.ok) {
    if (result.reason === "timeout") throw new ProviderTimeoutError(result.message);
    throw new Error(result.message);
  }

  // The brief decides which style every line must use, so it travels with the hold.
  const cardStyle = prepared.brief?.cardStyle;

  if (prepared.targetKind === "pack") {
    const read = generatedPackBundle(result.text, {
      cardStyle,
      language: prepared.brief?.targetLanguage,
      sourceLanguage: prepared.brief?.sourceLanguage,
      studyInstruction: prepared.brief?.studyInstruction,
      level: prepared.level,
    });
    if (!read.ok) throw new Error(`Nothing was saved, because ${read.message}.`);
    const imported = await importBundle(JSON.stringify(read.bundle), { kind: "pack" }, {
      namePolicy: "auto-suffix",
      origin: "generated",
      requestId: prepared.id,
    });
    if (!imported.ok) throw importFailure(imported.issues);
    const pack = await readPack(imported.packName);
    const cards = (await readCards()).filter(
      (card) => card.origin.requestId === prepared.id && card.packName === imported.packName,
    );
    return { kind: "pack", packName: imported.packName, count: imported.cardsAdded, cards, pack };
  }

  if (prepared.targetKind === "deck") {
    if (!prepared.packName) throw new Error("That pack is no longer here.");
    const parent = await readPack(prepared.packName);
    const read = generatedDeckBundle(result.text, {
      cardStyle,
      language: parent?.language,
      sourceLanguage: parent?.sourceLanguage,
      level: prepared.level,
    });
    if (!read.ok) throw new Error(`Nothing was saved, because ${read.message}.`);
    const imported = await importBundle(JSON.stringify(read.bundle), {
      kind: "deck",
      packName: prepared.packName,
    }, {
      namePolicy: "auto-suffix",
      origin: "generated",
      requestId: prepared.id,
    });
    if (!imported.ok) throw importFailure(imported.issues);
    const deckId = imported.deckIds[0];
    const pack = await readPack(imported.packName);
    const cards = (await readCards()).filter(
      (card) => card.origin.requestId === prepared.id && card.packName === imported.packName,
    );
    return { kind: "deck", packName: imported.packName, deckId, count: imported.cardsAdded, cards, pack };
  }

  if (!prepared.packName || !prepared.deckId) throw new Error("That deck is no longer here.");
  const pack = await readPack(prepared.packName);
  const deck = pack?.decks.find((entry) => entry.id === prepared.deckId);
  if (!deck) throw new Error("The deck for these cards is gone.");
  const read = generatedCardsBundle(result.text, deck, {
    cardStyle,
    language: pack?.language,
    sourceLanguage: pack?.sourceLanguage,
  });
  if (!read.ok) throw new Error(`Nothing was saved, because ${read.message}.`);
  const imported = await importBundle(JSON.stringify(read.bundle), {
    kind: "cards",
    packName: prepared.packName,
    deckId: prepared.deckId,
  }, {
    origin: "generated",
    requestId: prepared.id,
  });
  if (!imported.ok) throw importFailure(imported.issues);
  const cards = (await readCards()).filter(
    (card) => card.origin.requestId === prepared.id && card.deckId === prepared.deckId,
  );
  return {
    kind: "cards",
    packName: imported.packName,
    deckId: prepared.deckId,
    count: imported.cardsAdded,
    cards,
  };
}

/** Ask for a hint: the pack's free hint first, the tutor only when approved. */
export async function askHint(body: {
  cardId?: string;
  approved?: boolean;
  usedHints?: string[];
  outcomeCategory?: string;
}): Promise<{
  text: string | null;
  source: string;
  prompt: string | null;
  providerMessage: string | null;
}> {
  if (!body.cardId) throw new Error("A hint needs to know which card it is for.");
  const cards = await readCards();
  const card = cards.find((entry) => entry.id === body.cardId);
  if (!card) throw new Error("That card is not in the deck.");

  const pack = card.packName ? await readPack(card.packName) : null;
  const config = await providerConfig();
  let providerMessage: string | null = null;

  if (config.ok && pack && body.approved === true) {
    const slots = await profileSlots(cards);
    const attempt = await requestTutorHint(
      packRecord(pack),
      card,
      slots,
      body.outcomeCategory ?? "not answered yet",
      config.config,
      callBrowserProvider,
    );
    await appendPrompt({
      at: new Date().toISOString(),
      kind: "hint",
      requestId: card.id,
      endpoint: config.config.url,
      model: config.config.model,
      prompt: attempt.prompt,
    });
    if (attempt.ok) return { text: attempt.text, source: "tutor", prompt: attempt.prompt, providerMessage: null };
    providerMessage = attempt.message;
  } else if (body.approved === true && !config.ok) {
    providerMessage = config.message;
  }

  const packHint = pickPackHint(card, body.usedHints ?? []);
  if (packHint) return { text: packHint, source: "pack", prompt: null, providerMessage };
  return {
    text: null,
    source: "none",
    prompt: null,
    providerMessage: providerMessage ?? "No hint is available for this card.",
  };
}
