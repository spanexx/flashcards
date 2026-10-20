// WHY: Judging happens on the local process, against the card's own declared
// expectations. Every region becomes a row before the reveal, so the record is
// complete even if the browser is closed the same second.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { randomUUID } from "node:crypto";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { appendEvidence, readEvidence } from "@/lib/repository";
import { countSeenBefore, makeAnswerRows } from "@/lib/core/evidence";
import { judgeCard } from "@/lib/core/judge";
import {
  asNumber,
  asRecord,
  asString,
  jsonError,
  readJsonBody,
} from "@/lib/api/http";
import type { AnswerResult } from "@/lib/shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The answer arrived in a shape the app does not understand.");

    const cardId = asString(body.cardId);
    if (!cardId) return jsonError("An answer needs to say which card it belongs to.");

    const state = await ensureBootstrapped();
    const card = state.cards.find((entry) => entry.id === cardId);
    if (!card) return jsonError("That card is not in the deck.", 404);

    const rawAnswers = asRecord(body.answers) ?? {};
    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawAnswers)) {
      if (typeof value === "string") answers[key] = value;
    }

    const attemptId = asString(body.attemptId) ?? randomUUID();
    const timeMs = asNumber(body.timeMs, 0, 0, 24 * 60 * 60 * 1000);
    const hintUsed = body.hintUsed === true;

    const rows = await readEvidence();
    const seenBefore = countSeenBefore(rows, cardId);
    const judged = judgeCard(card.answerDef, answers, seenBefore, hintUsed);
    const at = new Date().toISOString();
    const newRows = makeAnswerRows(cardId, attemptId, judged.results, timeMs, seenBefore, at);
    await appendEvidence(newRows);

    const result: AnswerResult = {
      cardId,
      attemptId,
      results: judged.results,
      cardOutcome: judged.cardOutcome,
      capped: judged.capped,
      judge: judged.judge,
      rows: newRows,
    };
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The answer could not be judged.", 500);
  }
}
