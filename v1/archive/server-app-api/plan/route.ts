// WHY: The learner sees the plan before any card, with plain reasons. The
// algorithm receipt and the tutor banner are attached here but stay quiet: the
// receipt lives in settings, and the banner waits for the learner's yes.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { appendSession, readEvidence, readSessions } from "@/lib/repository";
import { buildPlan } from "@/lib/core/plan";
import { readSettings, recordAlgorithmRun } from "@/lib/core/settings";
import { describeTutorShape, describeTutorSlots, tutorSlotNames } from "@/lib/provider/prompt";
import { providerStatus } from "@/lib/provider/config";
import { jsonError } from "@/lib/api/http";
import type { TutorBanner } from "@/lib/shared/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const state = await ensureBootstrapped();
    const active = state.cards.filter((card) => !card.retired);
    if (active.length === 0) {
      return Response.json({
        plan: null,
        message: "No cards yet. Drop a pack into the packs folder, or write one by hand.",
      });
    }

    const rows = await readEvidence();
    const events = await readSessions();
    let settings = await readSettings();

    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("offer"));
    const offer = Number.isFinite(requested) && requested >= 1 ? Math.min(200, Math.floor(requested)) : undefined;

    const result = buildPlan(
      {
        cards: state.cards,
        rows,
        events,
        topicLabels: state.topicLabels,
        now: new Date(),
        offer,
      },
      settings.algorithm.fallbackCount,
    );

    const now = new Date().toISOString();
    if (result.usedFallback) settings = await recordAlgorithmRun("fallback", now);
    else if (settings.algorithm.lastAlgorithm !== "default") settings = await recordAlgorithmRun("default", now);
    result.plan.fallbackCount = settings.algorithm.fallbackCount;

    const first = result.plan.cards[0];
    const pack =
      (first ? state.packs.find((entry) => entry.name === first.origin.packName && !entry.error) : null) ??
      state.packs.find((entry) => !entry.error) ??
      null;
    const status = await providerStatus();

    let banner: TutorBanner | null = null;
    if (status.configured && status.hasKey && pack) {
      const names = tutorSlotNames(pack);
      banner = {
        available: true,
        model: status.model,
        endpoint: status.endpoint,
        seesCardText: names.includes("cardText"),
        seesOutcomeCategory: names.includes("outcomeCategory"),
        seesLearnerText: false,
        slots: describeTutorSlots(pack),
        shape: describeTutorShape(pack),
      };
    }
    result.plan.banner = banner;

    await appendSession({
      type: "started",
      id: result.plan.sessionId,
      at: now,
      offered: result.plan.offer,
    });

    return Response.json({ plan: result.plan, message: null });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "The plan could not be built.",
      500,
    );
  }
}
