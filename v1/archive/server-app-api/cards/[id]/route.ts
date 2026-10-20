// WHY: Editing makes a new card and retires the old one, so evidence already
// earned is never silently attached to different words. Deleting is the one
// deliberate act that also removes the card's evidence, because the learner
// asked for the card to be gone.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { randomUUID } from "node:crypto";
import { ensureBootstrapped, loadCards, saveCards } from "@/lib/bootstrap";
import { buildCard, hardRuleIssues, looksLikeSimpleCard, manualCardId, simpleCardSchema, simpleCardToSource } from "@/lib/core/card";
import { cardSourceSchema, issuesFromZod } from "@/lib/core/schema";
import { deleteCardEvidence } from "@/lib/repository";
import { asRecord, jsonError, readJsonBody } from "@/lib/api/http";
import type { CardSource } from "@/lib/shared/types";

export const runtime = "nodejs";

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
  if (patch.key === undefined) delete merged.key;
  return merged;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const state = await ensureBootstrapped();
    const existingCard = state.cards.find((entry) => entry.id === id);
    if (!existingCard) return jsonError("That card is not in the deck.", 404);

    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The edit arrived in a shape the app does not understand.");

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
      const simple = simpleCardSchema.safeParse(body);
      if (!simple.success) return jsonError("The card is missing something.", 400, issuesFromZod(simple.error, 0));
      source = simpleCardToSource(simple.data);
    } else {
      source = mergeSource(base, body);
      const parsed = cardSourceSchema.safeParse(source);
      if (!parsed.success) return jsonError("The card is missing something.", 400, issuesFromZod(parsed.error, 0));
      source = parsed.data;
    }

    const issues = hardRuleIssues(source);
    if (issues.length > 0) return jsonError("The card did not pass its checks.", 400, issues);

    const now = new Date().toISOString();
    const card = buildCard(
      source,
      {
        kind: "learner",
        note: `Written by the learner, editing a card that came from ${existingCard.origin.kind}.`,
        packName: existingCard.origin.packName,
      },
      manualCardId(randomUUID()),
      now,
    );
    card.editedFrom = existingCard.id;

    const cards = await loadCards();
    const next = cards.map((entry) =>
      entry.id === existingCard.id ? { ...entry, retired: true } : entry,
    );
    await saveCards([...next, card]);
    return Response.json({ card, retired: existingCard.id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The edit could not be saved.", 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cards = await loadCards();
    const existing = cards.find((entry) => entry.id === id);
    if (!existing) return jsonError("That card is not in the deck.", 404);

    await saveCards(cards.filter((entry) => entry.id !== id));
    const removedRows = await deleteCardEvidence(id);
    return Response.json({ deleted: true, removedEvidenceRows: removedRows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The card could not be deleted.", 500);
  }
}
