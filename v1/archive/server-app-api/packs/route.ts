// WHY: The library is a folder, so this route just reports what the folder
// holds: loaded packs, broken packs with plain reasons, and cards whose pack
// folder is gone but whose evidence is not.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await ensureBootstrapped();
    return Response.json({
      packs: state.statuses,
      orphans: state.orphanedPacks,
      folder: state.packsDir,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The pack folder could not be read.", 500);
  }
}
