// WHY: A learner can drop a pack into the folder while the app is running.
// Rescan re-reads the library and adopts anything new, exactly like startup.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const state = await ensureBootstrapped(true);
    return Response.json({
      packs: state.statuses,
      orphans: state.orphanedPacks,
      folder: state.packsDir,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The pack folder could not be rescanned.", 500);
  }
}
