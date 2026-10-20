// WHY: The local prompt log is part of the privacy promise, so the learner can
// read exactly what was sent, newest first, without leaving the app.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { readPromptLog } from "@/lib/provider/log";
import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit"));
    const entries = await readPromptLog(Number.isFinite(limit) && limit > 0 ? Math.min(500, limit) : 50);
    return Response.json({ entries });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The prompt log could not be read.", 500);
  }
}
