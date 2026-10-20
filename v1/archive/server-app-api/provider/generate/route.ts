// WHY: Sending happens only for a prepared, seen prompt. The model's lines are
// checked as a batch, and nothing is saved until every line passes.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { ensureBootstrapped, loadCards, saveCards } from "@/lib/bootstrap";
import { callProvider } from "@/lib/provider/client";
import { getProviderConfig } from "@/lib/provider/config";
import { generateCardsFromText } from "@/lib/provider/generate";
import { takePrepared } from "@/lib/provider/prepare";
import { appendPromptLog } from "@/lib/provider/log";
import { asRecord, asString, jsonError, readJsonBody } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    const requestId = body ? asString(body.requestId) : null;
    if (!requestId) return jsonError("A prepared prompt id is needed.");

    const prepared = takePrepared(requestId);
    if (!prepared || prepared.kind !== "generation") {
      return jsonError("That prepared prompt has expired. Prepare it again.");
    }

    const state = await ensureBootstrapped();
    const pack = state.packs.find((entry) => entry.name === prepared.packName && !entry.error);
    if (!pack) return jsonError("That pack is no longer in the library.", 404);

    const config = await getProviderConfig();
    if (!config.ok) return jsonError(config.message);

    const result = await callProvider(config.config, prepared.messages, { timeoutMs: 60000 });
    await appendPromptLog({
      at: new Date().toISOString(),
      kind: "generation",
      requestId: prepared.id,
      endpoint: config.config.url,
      model: config.config.model,
      prompt: prepared.display,
    });

    if (!result.ok) return jsonError(result.message, 502);

    const now = new Date().toISOString();
    let cards;
    try {
      cards = generateCardsFromText(
        pack,
        prepared.id,
        result.text,
        prepared.topic ?? pack.topics[0] ?? "general",
        now,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "the provider's answer was not usable";
      return jsonError(`Nothing was saved, because ${reason}.`, 400);
    }

    const existing = await loadCards();
    const byId = new Map(existing.map((card) => [card.id, card]));
    for (const card of cards) byId.set(card.id, card);
    await saveCards([...byId.values()]);

    return Response.json({ cards });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The cards could not be generated.", 500);
  }
}
