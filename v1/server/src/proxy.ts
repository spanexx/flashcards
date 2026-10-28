// WHY: The browser speaks the same chat-completions shape it uses for its own
// provider. This module accepts that shape, replaces the model with the one the
// operator configured, and never forwards a field the contract did not name.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

/** One message the browser may send. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** The checked request forwarded upstream. */
export interface ChatRequest {
  messages: ChatMessage[];
  temperature: number;
}

export type ChatRequestResult =
  | { ok: true; request: ChatRequest }
  | { ok: false; message: string };

/** Where a chat call goes, mirroring the app's own base-address rule. */
export function upstreamChatUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export const MAX_MESSAGE_CHARS = 200_000;
export const MAX_REPLY_CHARS = 2_000_000;
const MAX_MESSAGES = 40;

/** Read a request body, naming exactly what is wrong when it cannot be used. */
export function readChatRequest(raw: unknown): ChatRequestResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "The request needs a messages list." };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.messages) || record.messages.length === 0) {
    return { ok: false, message: "The request needs a messages list." };
  }
  if (record.messages.length > MAX_MESSAGES) {
    return { ok: false, message: `A request may hold at most ${MAX_MESSAGES} messages.` };
  }

  const messages: ChatMessage[] = [];
  let total = 0;
  for (const entry of record.messages) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, message: "Every message needs a role and text." };
    }
    const message = entry as Record<string, unknown>;
    if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") {
      return { ok: false, message: "Every message needs a role and text." };
    }
    if (typeof message.content !== "string") {
      return { ok: false, message: "Every message needs a role and text." };
    }
    total += message.content.length;
    if (total > MAX_MESSAGE_CHARS) {
      return { ok: false, message: "The request is longer than this provider accepts." };
    }
    messages.push({ role: message.role, content: message.content });
  }

  let temperature = 0.2;
  if (record.temperature !== undefined) {
    if (typeof record.temperature !== "number" || !Number.isFinite(record.temperature)) {
      return { ok: false, message: "The temperature must be a number." };
    }
    if (record.temperature < 0 || record.temperature > 2) {
      return { ok: false, message: "The temperature must be between 0 and 2." };
    }
    temperature = record.temperature;
  }

  return { ok: true, request: { messages, temperature } };
}

/** One upstream call's needs. The key and address never reach a browser. */
export interface ProxyOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export type ProxyResult =
  | { ok: true; payload: unknown }
  | { ok: false; status: number; message: string };

const BUSY: ProxyResult = {
  ok: false,
  status: 429,
  message: "The system provider is asking us to slow down. Try again in a moment.",
};

const BAD_GATEWAY: ProxyResult = {
  ok: false,
  status: 502,
  message: "The system provider could not answer. Try again in a moment.",
};

const TIMEOUT: ProxyResult = {
  ok: false,
  status: 504,
  message: "The system provider took too long to answer.",
};

/** Read a response body but refuse to hold more than the limit. */
async function readLimitedReply(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REPLY_CHARS) return null;
  const text = await response.text();
  return text.length > MAX_REPLY_CHARS ? null : text;
}

/**
 * Send one chat request upstream. No retries and no streaming: a failure is
 * reported by class, and no upstream body, header or key is ever returned.
 */
export async function proxyChat(options: ProxyOptions, raw: unknown): Promise<ProxyResult> {
  const read = readChatRequest(raw);
  if (!read.ok) return { ok: false, status: 400, message: read.message };

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(upstreamChatUrl(options.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: read.request.messages,
        temperature: read.request.temperature,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return aborted ? TIMEOUT : BAD_GATEWAY;
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) return BUSY;
  if (!response.ok) return BAD_GATEWAY;

  const text = await readLimitedReply(response);
  if (text === null) return BAD_GATEWAY;
  try {
    return { ok: true, payload: JSON.parse(text) as unknown };
  } catch {
    return BAD_GATEWAY;
  }
}
