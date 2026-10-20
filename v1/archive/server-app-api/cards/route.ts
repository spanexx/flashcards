// WHY: Writing a card by hand is the plainest path in the app: one card, checked
// by the same hard rules a pack card faces, then saved with a learner origin note.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { randomUUID } from "node:crypto";
import { ensureBootstrapped, loadCards, saveCards } from "@/lib/bootstrap";
import { buildCard, hardRuleIssues, looksLikeSimpleCard, manualCardId, simpleCardSchema, simpleCardToSource } from "@/lib/core/card";
import { cardSourceSchema, issuesFromZod } from "@/lib/core/schema";
import { asRecord, jsonError, readJsonBody } from "@/lib/api/http";
import type { CardSource } from "@/lib/shared/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await ensureBootstrapped();
    return Response.json({ cards: state.cards, orphans: state.orphanedPacks });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The deck could not be read.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The card arrived in a shape the app does not understand.");

    let source: CardSource | null = null;
    if (looksLikeSimpleCard(body)) {
      const simple = simpleCardSchema.safeParse(body);
      if (!simple.success) return jsonError("The card is missing something.", 400, issuesFromZod(simple.error, 0));
      source = simpleCardToSource(simple.data);
    } else {
      const parsed = cardSourceSchema.safeParse(body);
      if (!parsed.success) return jsonError("The card is missing something.", 400, issuesFromZod(parsed.error, 0));
      source = parsed.data;
    }

    const issues = hardRuleIssues(source);
    if (issues.length > 0) return jsonError("The card did not pass its checks.", 400, issues);

    const now = new Date().toISOString();
    const card = buildCard(
      source,
      { kind: "learner", note: "Written by the learner." },
      manualCardId(randomUUID()),
      now,
    );
    const existing = await loadCards();
    await saveCards([...existing, card]);
    return Response.json({ card }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The card could not be saved.", 500);
  }
}
