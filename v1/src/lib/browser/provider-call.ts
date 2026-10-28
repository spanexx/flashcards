// WHY: Every call to the learner's own provider takes the same road decision:
// direct first, the relay only when the browser cannot reach the provider, and
// the road remembered so the next call does not repeat a doomed attempt.
// PACK: provider-relay
// 2026-10-28 qoder: created for the learner's own provider relay. [pack: provider-relay]

import { callProvider, type ChatMessage, type ProviderCallResult } from "@/lib/provider/client";
import type { ProviderConfig } from "@/lib/provider/types";
import { providerHost } from "@/lib/core/settings-shape";
import { forgetRelayHost, rememberRelayHost } from "@/lib/browser/repository";

/** Call the learner's provider and remember which road answered. */
export async function callBrowserProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  options: { timeoutMs?: number } = {},
): Promise<ProviderCallResult> {
  const result = await callProvider(config, messages, options);
  const host = providerHost(config.url);
  if (!result.ok || !host || !config.relayBase) return result;
  if (result.via === "relay") await rememberRelayHost(host);
  else if (result.via === "direct") await forgetRelayHost(host);
  return result;
}
