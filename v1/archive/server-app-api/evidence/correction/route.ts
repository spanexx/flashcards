// WHY: The learner is the final judge of their own answer. A correction is a
// second row pointing at the first; the original is never edited or erased.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { appendEvidence, readEvidence } from "@/lib/repository";
import { makeCorrectionRow } from "@/lib/core/evidence";
import { asRecord, asString, jsonError, readJsonBody } from "@/lib/api/http";
import type { Outcome } from "@/lib/shared/types";

export const runtime = "nodejs";

const CORRECTABLE = new Set<Outcome>(["again", "got_it", "nearly", "no"]);

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The correction arrived in a shape the app does not understand.");
    const rowId = asString(body.rowId);
    const outcome = asString(body.outcome) as Outcome | null;
    if (!rowId) return jsonError("A correction needs to say which answer it is about.");
    if (!outcome || !CORRECTABLE.has(outcome)) {
      return jsonError("A correction must pick one of: got it, nearly, again, no.");
    }

    const rows = await readEvidence();
    const original = rows.find((row) => row.id === rowId);
    if (!original) return jsonError("That answer row is not in the record.", 404);

    const correction = makeCorrectionRow(original, outcome, new Date().toISOString());
    await appendEvidence([correction]);
    return Response.json({ correction });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The correction could not be saved.", 500);
  }
}
