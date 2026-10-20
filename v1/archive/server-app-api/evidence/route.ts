// WHY: The evidence drawer shows one card's whole story honestly: the rows as
// written, and the attempts as the learner sees them once corrections are
// layered on top.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { readEvidence } from "@/lib/repository";
import { groupAttempts } from "@/lib/core/evidence";
import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const cardId = new URL(request.url).searchParams.get("cardId");
    if (!cardId) return jsonError("The evidence drawer needs a card id.");

    const state = await ensureBootstrapped();
    const card = state.cards.find((entry) => entry.id === cardId);
    if (!card) return jsonError("That card is not in the deck.", 404);

    const rows = await readEvidence();
    const cardRows = rows.filter((row) => row.cardId === cardId);
    return Response.json({
      card,
      rows: cardRows,
      attempts: groupAttempts(cardRows, cardId),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The evidence could not be read.", 500);
  }
}
