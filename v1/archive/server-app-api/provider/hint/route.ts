// WHY: Hints work with or without a provider. Pack hints are the free offline
// floor; the tutor is only asked when the learner approved the banner, and a
// tutor failure quietly falls back instead of blocking the card.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { readEvidence } from "@/lib/repository";
import { deriveWeakTopics } from "@/lib/core/progress";
import { readSettings } from "@/lib/core/settings";
import { getProviderConfig } from "@/lib/provider/config";
import { pickPackHint, requestTutorHint } from "@/lib/provider/hint";
import { appendPromptLog } from "@/lib/provider/log";
import { asRecord, asString, asStringArray, jsonError, readJsonBody } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The hint request arrived in a shape the app does not understand.");

    // Pack hints are local and always allowed. The tutor is only asked when the
    // learner approved the banner for this session.
    const approved = body.approved === true;

    const cardId = asString(body.cardId);
    if (!cardId) return jsonError("A hint needs to know which card it is for.");

    const state = await ensureBootstrapped();
    const card = state.cards.find((entry) => entry.id === cardId);
    if (!card) return jsonError("That card is not in the deck.", 404);

    const usedHints = asStringArray(body.usedHints) ?? [];
    const outcomeCategory = asString(body.outcomeCategory) ?? "not answered yet";
    const pack = state.packs.find((entry) => entry.name === card.origin.packName && !entry.error) ?? null;

    const config = await getProviderConfig();
    let providerMessage: string | null = null;

    if (config.ok && pack && approved) {
      const rows = await readEvidence();
      const settings = await readSettings();
      const slots = {
        weakTopics: deriveWeakTopics(state.cards, rows),
        level: settings.level,
        learningStyle: settings.learningStyle,
      };
      const attempt = await requestTutorHint(pack, card, slots, outcomeCategory, config.config);
      await appendPromptLog({
        at: new Date().toISOString(),
        kind: "hint",
        requestId: card.id,
        endpoint: config.config.url,
        model: config.config.model,
        prompt: attempt.prompt,
      });
      if (attempt.ok) {
        return Response.json({ text: attempt.text, source: "tutor", prompt: attempt.prompt, providerMessage: null });
      }
      providerMessage = attempt.message;
    } else if (approved && !config.ok) {
      providerMessage = config.message;
    }

    const packHint = pickPackHint(card, usedHints);
    if (packHint) {
      return Response.json({ text: packHint, source: "pack", prompt: null, providerMessage });
    }
    return Response.json({
      text: null,
      source: "none",
      prompt: null,
      providerMessage: providerMessage ?? "No hint is available for this card.",
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The hint could not be asked for.", 500);
  }
}
