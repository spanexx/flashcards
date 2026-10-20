// WHY: Import is all-or-nothing: every problem is named before a single card
// is written, and content already in the deck is reported rather than doubled.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { loadCards, saveCards } from "@/lib/bootstrap";
import { importCards } from "@/lib/core/import";
import { asRecord, asString, jsonError, readJsonBody } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    const text = body ? asString(body.json) : null;
    if (!text || text.trim().length === 0) {
      return jsonError("Paste the cards as JSON before importing.");
    }

    const existing = await loadCards();
    const result = importCards(text, existing.map((card) => card.id), new Date().toISOString());
    if (!result.ok) {
      return jsonError("Nothing was imported, because some cards need fixing.", 400, result.issues);
    }

    await saveCards([...existing, ...result.cards]);
    return Response.json({ imported: result.cards.length, duplicates: result.duplicates, cards: result.cards });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The import could not be read.", 500);
  }
}
