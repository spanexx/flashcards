// WHY: How a session ends is what shapes tomorrow's offer: finishing raises it
// a little, stopping early lowers it a little, and neither is ever mentioned.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { appendSession } from "@/lib/repository";
import { asNumber, asRecord, asString, jsonError, readJsonBody } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The session end arrived in a shape the app does not understand.");
    const sessionId = asString(body.sessionId);
    if (!sessionId) return jsonError("A finished session needs its id.");

    const event = {
      type: "ended" as const,
      id: sessionId,
      at: new Date().toISOString(),
      offered: asNumber(body.offered, 0, 0, 1000),
      answered: asNumber(body.answered, 0, 0, 1000),
      completed: body.completed === true,
      stopped: body.stopped === true,
    };
    await appendSession(event);
    return Response.json({ ok: true, event });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The session end could not be saved.", 500);
  }
}
