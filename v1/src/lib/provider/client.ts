// WHY: The local process is the only thing that talks to a provider. This
// module keeps that call small, explains failures in plain words, and never
// retries in a loop or touches a key it does not need.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: runs in the browser too; the config arrives as an
// argument, so no server-only import remains. [pack: browser-app]
// 2026-10-23 opencode: failures carry a reason so a job retries only a timeout.
// [pack: background-jobs]
// 2026-10-28 qoder: a direct failure that never reached the provider may be
// retried through the relay, and an answer names the road it took.
// [pack: provider-relay]

import type { ProviderConfig } from "@/lib/provider/types";

/** One chat message. The whole tutor and generation design talks in these. */
export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Why a provider call failed, so a job retries only a timeout. */
export type ProviderFailureReason = "timeout" | "unreachable" | "http" | "empty";

/** A provider call either returns text or a sentence a person can act on. */
export type ProviderCallResult =
  | { ok: true; text: string; via?: "direct" | "relay" }
  | { ok: false; message: string; reason: ProviderFailureReason };

/** A timeout is the one provider failure a background job retries. */
export class ProviderTimeoutError extends Error {
  readonly reason = "timeout";

  constructor(message: string) {
    super(message);
    this.name = "ProviderTimeoutError";
  }
}

/** Candidate endpoints, in the order they are tried. */
export function chatEndpoints(baseUrl: string): string[] {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return [base];
  const candidates = [`${base}/chat/completions`];
  if (!base.endsWith("/v1")) candidates.push(`${base}/v1/chat/completions`);
  return candidates;
}

/**
 * Read the plain sentence a service put in an error body. The system provider
 * explains a refused subscription this way, and the learner should see that
 * sentence instead of a generic key warning.
 */
export function readErrorSentence(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const value = (payload as { error?: unknown }).error;
  if (typeof value !== "string") return null;
  const sentence = value.trim();
  if (sentence.length === 0 || sentence.length > 300) return null;
  return sentence;
}

/** Plain sentence for an HTTP failure. Never includes a key or a header. */
export function describeHttpFailure(status: number, url: string): string {
  if (status === 401 || status === 403) return "The provider rejected the key. Check the key in settings.";
  if (status === 404) return `The provider has no chat endpoint at ${url}. Check the address.`;
  if (status === 429) return "The provider is asking us to slow down. Try again in a moment.";
  if (status >= 500) return "The provider had a problem on its side. Try again in a moment.";
  return `The provider answered ${status} at ${url}.`;
}

/**
 * Plain sentence for a network-level failure. A browser blocks a cross-origin
 * call when the provider refuses it with CORS, and that is the common cause;
 * the sentence names it as likely and says what the learner can do.
 */
export function describeUnreachable(url: string): string {
  return `The provider could not be reached at ${url}. If the address is right, the provider is probably refusing calls from this site (CORS). Ask the provider to allow this site, or use a provider that does.`;
}

/** Read the reply text out of a common chat-completions reply. */
export function readReplyText(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
  if (typeof first.message?.content === "string") return first.message.content;
  if (typeof first.text === "string") return first.text;
  return null;
}

/** One road's answer, with the HTTP status kept for the road decision. */
interface Attempt {
  result: ProviderCallResult;
  status: number | null;
}

/** One direct call from this browser to one candidate endpoint. */
async function directAttempt(
  config: ProviderConfig,
  url: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  // Plain server-side lines so a learner can watch the local log while
  // testing a provider. The key and the headers never appear in a line.
  console.info(`[provider] POST ${url} model=${config.model}`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = describeHttpFailure(response.status, url);
      // The service's own sentence wins when it gave one: a refused
      // subscription needs a different answer than a wrong key.
      try {
        message = readErrorSentence(await response.json()) ?? message;
      } catch {
        // No JSON body; the status sentence stands.
      }
      console.warn(`[provider] ${response.status} from ${url} in ${Date.now() - startedAt}ms — ${message}`);
      return { result: { ok: false, message, reason: "http" }, status: response.status };
    }

    const payload = (await response.json()) as unknown;
    const text = readReplyText(payload);
    if (!text || text.trim().length === 0) {
      console.warn(`[provider] empty reply from ${url} in ${Date.now() - startedAt}ms`);
      return {
        result: { ok: false, message: "The provider answered with no words.", reason: "empty" },
        status: response.status,
      };
    }
    console.info(`[provider] ok from ${url} in ${Date.now() - startedAt}ms, ${text.length} characters`);
    return { result: { ok: true, text }, status: response.status };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    const message = aborted ? "The provider took too long to answer." : describeUnreachable(url);
    console.warn(`[provider] ${message} (after ${Date.now() - startedAt}ms)`);
    return {
      result: { ok: false, message, reason: aborted ? "timeout" : "unreachable" },
      status: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** One relayed call. The relay is handed the learner's key for this call only. */
async function relayAttempt(
  config: ProviderConfig,
  url: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<Attempt> {
  const base = (config.relayBase ?? "").trim().replace(/\/+$/, "");
  if (base.length === 0) {
    return {
      result: { ok: false, message: "The relay is not available in this build.", reason: "unreachable" },
      status: null,
    };
  }
  const relayUrl = `${base}/api/relay/chat`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  console.info(`[provider] POST relay model=${config.model}`);
  try {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        url,
        model: config.model,
        messages,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = describeHttpFailure(response.status, url);
      try {
        message = readErrorSentence(await response.json()) ?? message;
      } catch {
        // The relay's status is enough.
      }
      console.warn(`[provider] relay ${response.status} in ${Date.now() - startedAt}ms — ${message}`);
      return { result: { ok: false, message, reason: "http" }, status: response.status };
    }

    const payload = (await response.json()) as unknown;
    const text = readReplyText(payload);
    if (!text || text.trim().length === 0) {
      return {
        result: { ok: false, message: "The provider answered with no words.", reason: "empty" },
        status: response.status,
      };
    }
    console.info(`[provider] ok via relay in ${Date.now() - startedAt}ms, ${text.length} characters`);
    return { result: { ok: true, text }, status: response.status };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      result: aborted
        ? { ok: false, message: "The provider took too long to answer.", reason: "timeout" }
        : { ok: false, message: "The relay could not be reached.", reason: "unreachable" },
      status: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send one message pair and return the text. The browser is tried first for a
 * provider that answers it; the relay carries the same call only when the
 * browser cannot reach the provider at all. An HTTP answer, a timeout or an
 * empty reply means the provider was reached, so the chain stops there.
 */
export async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  options: { timeoutMs?: number } = {},
): Promise<ProviderCallResult> {
  const timeoutMs = options.timeoutMs ?? 60000;
  const endpoints = chatEndpoints(config.url);
  const relayAvailable = (config.relayBase ?? "").trim().length > 0;
  const roadOrder: Array<"direct" | "relay"> =
    relayAvailable && config.preferRelay === true ? ["relay", "direct"] : ["direct", "relay"];
  let last: ProviderCallResult = {
    ok: false,
    message: "The provider could not be reached.",
    reason: "unreachable",
  };

  for (const endpoint of endpoints) {
    let nextEndpoint = false;
    for (const road of roadOrder) {
      if (road === "relay" && !relayAvailable) continue;
      const attempt =
        road === "direct"
          ? await directAttempt(config, endpoint, messages, timeoutMs)
          : await relayAttempt(config, endpoint, messages, timeoutMs);

      if (attempt.result.ok) return { ...attempt.result, via: road };
      last = attempt.result;

      if (attempt.result.reason === "timeout" || attempt.result.reason === "empty") {
        return attempt.result;
      }
      if (attempt.result.reason === "http") {
        // A 404 may mean the other candidate shape is the right one; any other
        // status is a real answer from the provider.
        if (attempt.status === 404) {
          nextEndpoint = true;
          break;
        }
        // A relayed 502/504 is the relay's own road failing, not an answer from
        // the provider; the browser may still reach it directly.
        if (road === "relay" && (attempt.status === 502 || attempt.status === 504)) continue;
        return attempt.result;
      }
      // Unreachable: the other road gets one try with the same endpoint.
    }
    if (nextEndpoint) continue;
  }

  return last;
}

/**
 * Pull one JSON object out of a model reply, even when it arrives inside a
 * code fence or with a friendly sentence around it.
 */
export function extractJson(text: string): unknown {
  const withoutFence = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("the provider's answer did not contain a JSON object");
  }
  const slice = withoutFence.slice(start, end + 1);
  try {
    return JSON.parse(slice) as unknown;
  } catch (error) {
    throw new Error(
      `the provider's JSON could not be read: ${
        error instanceof Error ? error.message : "unknown problem"
      }`,
    );
  }
}
