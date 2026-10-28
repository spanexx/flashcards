// WHY: The local process is the only thing that talks to a provider. This
// module keeps that call small, explains failures in plain words, and never
// retries in a loop or touches a key it does not need.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: runs in the browser too; the config arrives as an
// argument, so no server-only import remains. [pack: browser-app]
// 2026-10-23 opencode: failures carry a reason so a job retries only a timeout.
// [pack: background-jobs]

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
  | { ok: true; text: string }
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

/**
 * Send one message pair and return the text. One attempt per candidate
 * endpoint; a failure is reported, never retried forever.
 */
export async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  options: { timeoutMs?: number } = {},
): Promise<ProviderCallResult> {
  const timeoutMs = options.timeoutMs ?? 60000;
  const endpoints = chatEndpoints(config.url);
  let lastMessage = "The provider could not be reached.";

  for (let index = 0; index < endpoints.length; index += 1) {
    const url = endpoints[index];
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
        const willRetry = response.status === 404 && index + 1 < endpoints.length;
        lastMessage = describeHttpFailure(response.status, url);
        // The service's own sentence wins when it gave one: a refused
        // subscription needs a different answer than a wrong key.
        if (!willRetry) {
          try {
            lastMessage = readErrorSentence(await response.json()) ?? lastMessage;
          } catch {
            // No JSON body; the status sentence stands.
          }
        }
        console.warn(`[provider] ${response.status} from ${url} in ${Date.now() - startedAt}ms — ${lastMessage}`);
        // A 404 may mean the other candidate shape is the right one; anything
        // else is a real answer and should not be retried against a second URL.
        if (willRetry) continue;
        return { ok: false, message: lastMessage, reason: "http" };
      }

      const payload = (await response.json()) as unknown;
      const text = readReplyText(payload);
      if (!text || text.trim().length === 0) {
        console.warn(`[provider] empty reply from ${url} in ${Date.now() - startedAt}ms`);
        return { ok: false, message: "The provider answered with no words.", reason: "empty" };
      }
      console.info(`[provider] ok from ${url} in ${Date.now() - startedAt}ms, ${text.length} characters`);
      return { ok: true, text };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      lastMessage = aborted
        ? "The provider took too long to answer."
        : describeUnreachable(url);
      console.warn(`[provider] ${lastMessage} (after ${Date.now() - startedAt}ms)`);
      if (index + 1 < endpoints.length && !aborted) continue;
      return { ok: false, message: lastMessage, reason: aborted ? "timeout" : "unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, message: lastMessage, reason: "unreachable" };
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
