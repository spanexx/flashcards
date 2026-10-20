// WHY: Progress is built fresh from the evidence every time it is asked for.
// Nothing is stored, so there is no old conclusion to defend.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { readEvidence } from "@/lib/repository";
import { readProgress } from "@/lib/core/progress";
import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await ensureBootstrapped();
    const rows = await readEvidence();
    return Response.json({ progress: readProgress(state.cards, rows, state.topicLabels) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Progress could not be built.", 500);
  }
}
