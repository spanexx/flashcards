// WHY: A learner's provider may refuse the browser. This module forwards one
// call from the server instead, but only to a secure chat endpoint on a public
// address: it resolves the name, refuses private targets, pins the connection
// to the address it checked, follows no redirect, and keeps nothing.
// PACK: provider-relay
// 2026-10-28 qoder: created for the learner's own provider relay. [pack: provider-relay]

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import {
  MAX_REPLY_CHARS,
  readChatRequest,
  type ChatMessage,
  type ProxyResult,
} from "./proxy";

/** One address the name resolved to. */
export interface RelayAddress {
  address: string;
  family: number;
}

/** A DNS lookup, injectable so a test never touches a real name. */
export type RelayLookup = (hostname: string) => Promise<RelayAddress[]>;

/** The checked target a connection is pinned to. */
export interface PinnedTarget {
  address: string;
  hostHeader: string;
  servername: string | null;
  path: string;
  apiKey: string;
}

/** One HTTPS exchange; injectable so a test never opens a socket. */
export type RelaySend = (
  target: PinnedTarget,
  body: string,
) => Promise<{ status: number; text: string }>;

/** What the relay needs. No operator key lives here. */
export interface RelayOptions {
  timeoutMs: number;
  lookup?: RelayLookup;
  send?: RelaySend;
}

/** The checked request the relay forwards. */
export interface RelayRequest {
  url: URL;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  temperature: number;
}

export type RelayReadResult =
  | { ok: true; request: RelayRequest }
  | { ok: false; message: string };

const MAX_MODEL_CHARS = 200;
const MAX_KEY_CHARS = 4096;
const CHAT_SUFFIX = "/chat/completions";

/** A timeout is the one transport failure that is not retried on another address. */
export class RelayTimeoutError extends Error {
  constructor() {
    super("The provider took too long to answer.");
    this.name = "RelayTimeoutError";
  }
}

/** A reply over the ceiling ends the call; another address will not shrink it. */
export class RelayReplyTooLargeError extends Error {
  constructor() {
    super("The provider's answer was too large.");
    this.name = "RelayReplyTooLargeError";
  }
}

/** Names that never belong to a public provider. */
function blockedHostname(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  const suffixes = ["local", "internal", "home.arpa", "lan"];
  return suffixes.some((suffix) => name === suffix || name.endsWith(`.${suffix}`));
}

/** True when a URL host is an IP literal rather than a name. */
function isIpLiteral(hostname: string): boolean {
  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return bare.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(bare);
}

/** Strip the brackets Node keeps around an IPv6 URL hostname. */
function bareHost(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/** Private IPv6, including an IPv4 address mapped into it. */
function privateIpv6(value: string): boolean {
  const bare = bareHost(value.toLowerCase());
  if (bare === "::" || bare === "::1") return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(bare);
  if (mapped) return privateAddress(mapped[1]);
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(bare);
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16);
    const low = parseInt(hexMapped[2], 16);
    return privateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  if (/^f[cd]/.test(bare)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(bare)) return true; // fe80::/10 link local
  if (/^ff/.test(bare)) return true; // multicast
  if (bare.startsWith("2001:db8")) return true; // documentation
  return false;
}

/** True when an address must never be reached by the relay. */
export function privateAddress(address: string): boolean {
  const value = address.trim().toLowerCase();
  if (value.includes(":")) return privateIpv6(value);
  const parts = value.split(".");
  if (parts.length !== 4) return true;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** Read the target address, refusing anything that is not a secure chat endpoint. */
export function readRelayUrl(raw: string): { ok: true; url: URL } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "The provider address is not a full address." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, message: "The relay only calls secure (https) provider addresses." };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return { ok: false, message: "The provider address must not carry a username or password." };
  }
  if (url.port.length > 0 && url.port !== "443") {
    return { ok: false, message: "The relay only calls the standard secure port (443)." };
  }
  if (!url.pathname.endsWith(CHAT_SUFFIX)) {
    return { ok: false, message: "The relay only calls a chat-completions endpoint." };
  }
  url.hash = "";
  return { ok: true, url };
}

/**
 * Read one relay request. The key arrives as the bearer token and is named here
 * so a missing or unusable one is refused before any network work.
 */
export function readRelayRequest(raw: unknown): RelayReadResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "The request needs an address, a model and a key." };
  }
  const record = raw as Record<string, unknown>;
  const rawUrl = typeof record.url === "string" ? record.url.trim() : "";
  if (rawUrl.length === 0) {
    return { ok: false, message: "The request needs the provider address." };
  }
  const checked = readRelayUrl(rawUrl);
  if (!checked.ok) return checked;

  const model = typeof record.model === "string" ? record.model.trim() : "";
  if (model.length === 0 || model.length > MAX_MODEL_CHARS) {
    return { ok: false, message: `The model name must be 1 to ${MAX_MODEL_CHARS} characters.` };
  }

  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
  if (apiKey.length === 0 || apiKey.length > MAX_KEY_CHARS || /[\r\n]/.test(apiKey)) {
    return { ok: false, message: "The request needs a usable provider key." };
  }

  const chat = readChatRequest(record);
  if (!chat.ok) return { ok: false, message: chat.message };

  return {
    ok: true,
    request: {
      url: checked.url,
      model,
      apiKey,
      messages: chat.request.messages,
      temperature: chat.request.temperature,
    },
  };
}

export type ResolveResult =
  | { ok: true; addresses: string[] }
  | { ok: false; kind: "refused" | "dns"; message: string };

const defaultLookup: RelayLookup = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Resolve a name to public addresses. A literal is checked directly; a name is
 * resolved once and every address is checked, so a private answer is refused
 * before a socket exists.
 */
export async function resolveTarget(
  hostname: string,
  lookup: RelayLookup = defaultLookup,
): Promise<ResolveResult> {
  const bare = bareHost(hostname);
  if (isIpLiteral(hostname)) {
    if (privateAddress(bare)) {
      return { ok: false, kind: "refused", message: "The relay does not call private or local addresses." };
    }
    return { ok: true, addresses: [bare] };
  }
  if (blockedHostname(bare)) {
    return { ok: false, kind: "refused", message: "The relay does not call private or local addresses." };
  }
  let found: RelayAddress[];
  try {
    found = await lookup(bare);
  } catch {
    return { ok: false, kind: "dns", message: "The provider address could not be found." };
  }
  const publicOnes = found.map((entry) => bareHost(entry.address)).filter((address) => !privateAddress(address));
  if (publicOnes.length === 0) {
    return { ok: false, kind: "refused", message: "The relay does not call private or local addresses." };
  }
  return { ok: true, addresses: publicOnes };
}

/** The default sender: one HTTPS POST to the checked address, no redirects. */
export function pinnedSender(timeoutMs: number): RelaySend {
  return (target, body) =>
    new Promise((resolve, reject) => {
      const request = httpsRequest(
        {
          method: "POST",
          hostname: target.address,
          servername: target.servername ?? undefined,
          port: 443,
          path: target.path,
          headers: {
            host: target.hostHeader,
            "content-type": "application/json",
            accept: "application/json",
            authorization: `Bearer ${target.apiKey}`,
            "content-length": Buffer.byteLength(body),
          },
          timeout: timeoutMs,
        },
        (response) => {
          const status = response.statusCode ?? 502;
          const chunks: Buffer[] = [];
          let total = 0;
          let settled = false;
          const finish = (action: () => void) => {
            if (settled) return;
            settled = true;
            action();
          };
          response.on("data", (chunk: Buffer) => {
            if (settled) return;
            total += chunk.length;
            if (total > MAX_REPLY_CHARS) {
              response.destroy();
              finish(() => reject(new RelayReplyTooLargeError()));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () =>
            finish(() => resolve({ status, text: Buffer.concat(chunks).toString("utf8") })),
          );
          response.on("error", (error) => finish(() => reject(error)));
        },
      );
      request.on("timeout", () => request.destroy(new RelayTimeoutError()));
      request.on("error", (error) => reject(error));
      request.end(body);
    });
}

const BUSY: ProxyResult = {
  ok: false,
  status: 429,
  message: "The provider is asking us to slow down. Try again in a moment.",
};

const UNREACHABLE: ProxyResult = {
  ok: false,
  status: 502,
  message: "The provider could not be reached.",
};

const TIMEOUT: ProxyResult = {
  ok: false,
  status: 504,
  message: "The provider took too long to answer.",
};

/** A plain sentence for an upstream answer, mirroring the browser's own. */
function providerAnswer(status: number, url: string): string {
  if (status === 401 || status === 403) return "The provider rejected the key. Check the key in settings.";
  if (status === 404) return `The provider has no chat endpoint at ${url}. Check the address.`;
  if (status >= 500) return "The provider had a problem on its side. Try again in a moment.";
  return `The provider answered ${status}.`;
}

/** Turn one upstream exchange into the browser's result shape. */
function readAnswer(
  status: number,
  text: string,
  url: string,
): ProxyResult {
  if (status === 429) return BUSY;
  if (status >= 300 && status < 400) {
    return {
      ok: false,
      status: 502,
      message: "The provider tried to redirect the call, which this relay does not follow.",
    };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, status, message: providerAnswer(status, url) };
  }
  if (text.length > MAX_REPLY_CHARS) {
    return { ok: false, status: 502, message: "The provider's answer was too large." };
  }
  try {
    return { ok: true, payload: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 502, message: "The provider answered in a way this relay cannot read." };
  }
}

/**
 * Forward one call. The operator's key is never consulted: the only key that
 * can reach the provider is the one the learner sent.
 */
export async function relayChat(options: RelayOptions, raw: unknown): Promise<ProxyResult> {
  const read = readRelayRequest(raw);
  if (!read.ok) return { ok: false, status: 400, message: read.message };

  const target = await resolveTarget(read.request.url.hostname, options.lookup);
  if (!target.ok) {
    return { ok: false, status: target.kind === "refused" ? 400 : 502, message: target.message };
  }

  const url = read.request.url;
  const body = JSON.stringify({
    model: read.request.model,
    messages: read.request.messages,
    temperature: read.request.temperature,
  });
  const hostname = bareHost(url.hostname);
  const send = options.send ?? pinnedSender(options.timeoutMs);

  for (const address of target.addresses) {
    try {
      const answer = await send(
        {
          address,
          hostHeader: url.host,
          servername: isIpLiteral(url.hostname) ? null : hostname,
          path: `${url.pathname}${url.search}`,
          apiKey: read.request.apiKey,
        },
        body,
      );
      return readAnswer(answer.status, answer.text, url.toString());
    } catch (error) {
      if (error instanceof RelayTimeoutError) return TIMEOUT;
      if (error instanceof RelayReplyTooLargeError) {
        return { ok: false, status: 502, message: error.message };
      }
      // A connect failure on one address may be that address only; the loop
      // tries the next public one. The last failure becomes the answer.
    }
  }

  return UNREACHABLE;
}
