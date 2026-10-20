// WHY: The simulation and the learner's own eyes need one cheap way to see
// that the local process is alive.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { APP_VERSION } from "@/lib/version";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, version: APP_VERSION });
}
