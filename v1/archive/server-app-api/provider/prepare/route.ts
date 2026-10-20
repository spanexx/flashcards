// WHY: The learner must see the exact prompt before anything leaves. This route
// builds it, keeps it on the local process, and returns only its text and id.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped } from "@/lib/bootstrap";
import { readEvidence } from "@/lib/repository";
import { deriveWeakTopics } from "@/lib/core/progress";
import { readSettings } from "@/lib/core/settings";
import { buildGenerationPrompt } from "@/lib/provider/prompt";
import { holdPrepared } from "@/lib/provider/prepare";
import { asNumber, asRecord, asString, jsonError, readJsonBody } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The request arrived in a shape the app does not understand.");

    const packName = asString(body.packName);
    const topic = asString(body.topic);
    if (!packName) return jsonError("Choose which pack the cards should come from.");
    if (!topic) return jsonError("Choose a topic for the new cards.");

    const state = await ensureBootstrapped();
    const pack = state.packs.find((entry) => entry.name === packName && !entry.error);
    if (!pack) return jsonError("That pack is not in the library.", 404);
    if (!pack.topics.includes(topic)) {
      return jsonError(`"${topic}" is not a topic in ${pack.name}.`);
    }

    const count = asNumber(body.count, 5, 1, 20);
    const rows = await readEvidence();
    const weakTopics = deriveWeakTopics(state.cards, rows);
    const settings = await readSettings();

    const prompt = buildGenerationPrompt(
      pack,
      { weakTopics, level: settings.level, learningStyle: settings.learningStyle },
      { topic, count },
    );

    const prepared = holdPrepared({
      kind: "generation",
      display: prompt.display,
      messages: prompt.messages,
      packName: pack.name,
      topic,
      count,
      cardId: null,
    });

    return Response.json({
      requestId: prepared.id,
      prompt: prompt.display,
      expiresAt: prepared.expiresAt,
      weakTopics,
      level: settings.level,
      learningStyle: settings.learningStyle,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The prompt could not be prepared.", 500);
  }
}
