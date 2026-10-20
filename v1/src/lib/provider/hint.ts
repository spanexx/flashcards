// WHY: A hint caps the card at Nearly, so a hint must exist even with no
// provider. Packs can ship pre-written hints as the free offline floor; the
// provider supplies words only when the learner has approved its use.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: pure hint logic, safe in the browser; the config is
// passed in. [pack: browser-app]

import type { Card } from "@/lib/shared/types";
import type { PackRecord } from "@/lib/packs/types";
import { callProvider } from "@/lib/provider/client";
import { buildHintPrompt, type ProfileSlots } from "@/lib/provider/prompt";
import type { ProviderConfig } from "@/lib/provider/types";

/** The first pack hint the learner has not seen this session. */
export function pickPackHint(card: Card, alreadyShown: string[]): string | null {
  const hints = card.hints ?? [];
  for (const hint of hints) {
    if (!alreadyShown.includes(hint)) return hint;
  }
  return null;
}

/** Ask the provider for one short hint. Card question only; never learner text. */
export async function requestTutorHint(
  pack: PackRecord,
  card: Card,
  slots: ProfileSlots,
  outcomeCategory: string,
  config: ProviderConfig,
): Promise<{ ok: true; text: string; prompt: string } | { ok: false; message: string; prompt: string }> {
  const prompt = buildHintPrompt(pack, card, slots, outcomeCategory);
  const result = await callProvider(config, prompt.messages, { timeoutMs: 45000 });
  if (!result.ok) return { ok: false, message: result.message, prompt: prompt.display };
  return { ok: true, text: result.text.trim(), prompt: prompt.display };
}
