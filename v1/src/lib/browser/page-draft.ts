// WHY: "Draft with AI" must use the same provider lane as every other call and
// must show its exact prompt before sending. This module only assembles the
// context from the library and holds the prompt; the rules and the answer
// shape live in core/page-draft. A draft is never saved as a page on its own.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import type { PageLevel } from "@/lib/shared/types";
import { ProviderTimeoutError } from "@/lib/provider/client";
import { callBrowserProvider } from "@/lib/browser/provider-call";
import { holdPrepared, takePrepared } from "@/lib/provider/prepare";
import { buildPageDraftPrompt, readPageDraft, type PageDraft, type PageDraftContext } from "@/lib/core/page-draft";
import { providerConfig } from "@/lib/browser/provider";
import { appendPrompt, readCards, readPack } from "@/lib/browser/repository";

/** What the screen must name to draft one page. */
export interface PageDraftTarget {
  level: PageLevel;
  packName: string;
  deckId?: string;
  cardId?: string;
  /** The learner's own words for what the page should say. */
  instruction?: string;
}

/** The readable words of one card side; code and spoken text count too. */
function sideText(parts: readonly { type: string; text?: string }[]): string {
  return parts
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .filter((line) => line.trim().length > 0)
    .join(" / ");
}

/** Read the course facts the prompt may see, refusing a target that is gone. */
async function draftContext(target: PageDraftTarget): Promise<PageDraftContext> {
  const pack = await readPack(target.packName);
  if (!pack) throw new Error(`There is no pack "${target.packName}" here.`);

  if (target.level === "pack") {
    return {
      level: "pack",
      packName: pack.name,
      packDescription: pack.description,
      language: pack.language,
      sourceLanguage: pack.sourceLanguage,
    };
  }

  const deck = pack.decks.find((entry) => entry.id === target.deckId);
  if (!deck) throw new Error(`That deck is not in "${pack.name}".`);

  if (target.level === "deck") {
    return {
      level: "deck",
      packName: pack.name,
      packDescription: pack.description,
      deckName: deck.name,
      language: pack.language,
      sourceLanguage: pack.sourceLanguage,
    };
  }

  const card = (await readCards()).find((entry) => entry.id === target.cardId);
  if (!card || card.packName !== pack.name) throw new Error("That card is not in this pack.");
  return {
    level: "card",
    packName: pack.name,
    packDescription: pack.description,
    deckName: deck.name,
    cardSummary: card.summary,
    cardQuestion: sideText(card.prompt),
    cardAnswer: sideText(card.answer),
    language: pack.language,
    sourceLanguage: pack.sourceLanguage,
  };
}

/** Build the prompt and hold it until the learner approves it. */
export async function preparePageDraft(
  target: PageDraftTarget,
): Promise<{ requestId: string; prompt: string; expiresAt: number }> {
  const context = await draftContext(target);
  const prompt = buildPageDraftPrompt(context, target.instruction ?? "");
  const prepared = holdPrepared({
    kind: "page",
    display: prompt.display,
    messages: prompt.messages,
    targetKind: "cards",
    packName: context.packName,
    topic: context.deckName ?? null,
    deckId: target.deckId ?? null,
    count: 1,
    cardId: target.cardId ?? null,
  });
  return { requestId: prepared.id, prompt: prompt.display, expiresAt: prepared.expiresAt };
}

/** Send one approved draft prompt. The answer goes back to the editor unsaved. */
export async function generatePageDraft(requestId: string): Promise<PageDraft> {
  if (!requestId) throw new Error("A prepared prompt id is needed.");
  const prepared = takePrepared(requestId);
  if (!prepared || prepared.kind !== "page") {
    throw new Error("That prepared prompt has expired. Prepare it again.");
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
  const read = readPageDraft(result.text);
  if (!read.ok) throw new Error(`Nothing was drafted, because ${read.message}.`);
  return read.draft;
}
