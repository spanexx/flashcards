// WHY: One small router keeps the browser contract in one place: JSON in and
// out, one allowed origin, bounded bodies, a licence check before the paid
// model, and error sentences that never repeat a key or an upstream body.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { publicConfig, type ServerConfig } from "./config";
import {
  completeCheckout,
  openPortal,
  readEntitlement,
  refreshEntitlement,
  type EntitlementDeps,
  type EntitlementFailure,
} from "./entitlement";
import { proxyChat, type ProxyOptions } from "./proxy";
import {
  deliverRecoveryLink,
  normaliseEmail,
  redeemRecoveryLink,
  type RecoveryDeps,
} from "./recovery";
import { relayChat, type RelayOptions } from "./relay";
import type { StripeClient } from "./stripe";
import type { StatusCache } from "./subscriptions";
import { verifyStripeSignature } from "./webhook";

const MAX_BODY_BYTES = 1_000_000;
const MAX_WEBHOOK_BYTES = 512_000;

/** A sliding one-hour window per licence hash and address. Memory only. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Record one use, or say how long until the oldest leaves the window. */
  take(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const at = this.now();
    const cutoff = at - this.windowMs;
    const kept = (this.hits.get(key) ?? []).filter((stamp) => stamp > cutoff);
    if (kept.length >= this.limit) {
      this.hits.set(key, kept);
      const waitMs = kept[0] + this.windowMs - at;
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
    }
    kept.push(at);
    this.hits.set(key, kept);
    if (this.hits.size > 5_000) this.sweep(cutoff);
    return { ok: true };
  }

  /** How many keys are remembered; tests use it, operators do not. */
  size(): number {
    return this.hits.size;
  }

  private sweep(cutoff: number): void {
    for (const [key, stamps] of this.hits) {
      if (stamps.length === 0 || stamps[stamps.length - 1] <= cutoff) this.hits.delete(key);
    }
  }
}

/** The pieces an HTTP handler needs. All are injected for honest tests. */
export interface AppDeps {
  config: ServerConfig;
  stripe: StripeClient | null;
  subscriptions: StatusCache;
  proxy: ProxyOptions | null;
  relay: RelayOptions | null;
  recovery: RecoveryDeps | null;
  now?: () => number;
  rateLimiter?: RateLimiter;
  relayRateLimiter?: RateLimiter;
  recoveryRateLimiter?: RateLimiter;
  log?: (line: string) => void;
}

type ReadBody = { ok: true; text: string } | { ok: false; tooLarge: boolean };

/** Read a request body with a hard ceiling; never buffer past it. */
function readBody(req: IncomingMessage, limit: number): Promise<ReadBody> {
  return new Promise((resolve) => {
    const declared = Number(req.headers["content-length"] ?? "0");
    if (Number.isFinite(declared) && declared > limit) {
      req.resume();
      resolve({ ok: false, tooLarge: true });
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const finish = (result: ReadBody) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > limit) {
        req.resume();
        finish({ ok: false, tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", () => finish({ ok: false, tooLarge: false }));
    req.on("aborted", () => finish({ ok: false, tooLarge: false }));
  });
}

/** Send one JSON answer with no caching and no sniffing. */
function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

/** Errors keep one shape: a plain sentence under `error`. */
function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

/** Allow the one app origin; requests without an Origin are not browsers. */
function originAllowed(req: IncomingMessage, config: ServerConfig): boolean {
  const origin = req.headers.origin;
  return origin === undefined || origin === config.appOrigin;
}

/** Echo CORS only for the exact app origin. No wildcard, no credentials. */
function applyCors(req: IncomingMessage, res: ServerResponse, config: ServerConfig): void {
  if (req.headers.origin === config.appOrigin) {
    res.setHeader("access-control-allow-origin", config.appOrigin);
    res.setHeader("vary", "Origin");
  }
}

/** Read a JSON object body, answering 400 or 413 itself when it cannot. */
async function readJsonBody(
  req: IncomingMessage,
  res: ServerResponse,
  limit: number,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  const body = await readBody(req, limit);
  if (!body.ok) {
    sendError(res, body.tooLarge ? 413 : 400, body.tooLarge ? "The request is too large." : "The request could not be read.");
    return { ok: false };
  }
  if (body.text.trim().length === 0) return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text) as unknown;
  } catch {
    sendError(res, 400, "The request was not valid JSON.");
    return { ok: false };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    sendError(res, 400, "The request must be a JSON object.");
    return { ok: false };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

/** Map an entitlement refusal to the status the browser contract names. */
function failureStatus(code: EntitlementFailure["code"]): number {
  if (code === "invalid_license") return 401;
  if (code === "inactive" || code === "not_paid") return 402;
  if (code === "not_found") return 404;
  return 502;
}

function sendFailure(res: ServerResponse, failure: EntitlementFailure): void {
  sendError(res, failureStatus(failure.code), failure.message);
}

/** Read `Authorization: Bearer <license>`, or null. */
function bearerToken(req: IncomingMessage): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  if (!match) return null;
  return match[1].length > 0 && match[1].length <= 4096 ? match[1] : null;
}

/** The licence hash used in a rate-limit key, so raw tokens are not kept. */
function licenseKey(token: string, address: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return `${digest}:${address}`;
}

/**
 * The caller's address. The edge appends the real client last, so that entry is
 * the one used; a request without the header falls back to the socket.
 */
function clientAddress(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded.join(",") : (forwarded ?? "");
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const candidate = entries.length > 0 ? entries[entries.length - 1] : (req.socket.remoteAddress ?? "");
  return candidate.length > 0 && candidate.length <= 64 ? candidate : "unknown";
}

/** Build the entitlement dependencies for one app. */
function entitlementDeps(deps: AppDeps): EntitlementDeps {
  return {
    stripe: deps.stripe ?? {
      getCheckoutSession: async () => {
        throw new Error("Stripe is not configured.");
      },
      getSubscription: async () => {
        throw new Error("Stripe is not configured.");
      },
      createPortalSession: async () => {
        throw new Error("Stripe is not configured.");
      },
    },
    subscriptions: deps.subscriptions,
    licenseSecret: deps.config.licenseSecret,
    licenseTtlSeconds: deps.config.licenseTtlSeconds,
    now: deps.now,
  };
}

/** The checkout and portal return addresses, resolved against the app URL. */
export function appReturnUrl(appUrl: string, suffix: string): string {
  return new URL(suffix, appUrl).toString();
}

/** One request. Exported so a test can drive it without a socket if needed. */
export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AppDeps,
): Promise<void> {
  const config = deps.config;
  applyCors(req, res, config);

  if (!originAllowed(req, config)) {
    sendError(res, 403, "This origin is not allowed.");
    return;
  }

  if (req.method === "OPTIONS") {
    if (req.headers.origin === config.appOrigin) {
      res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      res.setHeader("access-control-allow-headers", "authorization, content-type");
      res.setHeader("access-control-max-age", "86400");
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://system-provider.local");
  const path = url.pathname;
  const method = req.method ?? "GET";
  const rateLimiter = deps.rateLimiter ?? new RateLimiter(config.rateLimitPerHour, undefined, deps.now);
  const relayRateLimiter =
    deps.relayRateLimiter ?? new RateLimiter(config.relayRateLimitPerHour, undefined, deps.now);
  const recoveryRateLimiter =
    deps.recoveryRateLimiter ??
    new RateLimiter(config.recovery?.rateLimitPerHour ?? 5, undefined, deps.now);

  if (method === "GET" && path === "/healthz") {
    const publicFacts = publicConfig(config);
    sendJson(res, 200, {
      ok: true,
      service: "flashcards-system-provider",
      checkout: publicFacts.checkout,
      proxy: publicFacts.proxy,
      relay: Boolean(deps.relay),
      recovery: publicFacts.recovery,
    });
    return;
  }

  if (method === "GET" && path === "/api/config") {
    sendJson(res, 200, publicConfig(config));
    return;
  }

  if (method === "POST" && path === "/api/checkout") {
    if (!deps.stripe || !config.stripePriceId) {
      sendError(res, 503, "Checkout is not configured.");
      return;
    }
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    try {
      const session = await deps.stripe.createCheckoutSession({
        priceId: config.stripePriceId,
        successUrl: appReturnUrl(config.appUrl, "settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
        cancelUrl: appReturnUrl(config.appUrl, "settings/?checkout=cancel"),
      });
      sendJson(res, 200, { url: session.url });
    } catch {
      sendError(res, 502, "Checkout could not be started. Try again in a moment.");
    }
    return;
  }

  if (method === "POST" && path === "/api/entitlement/checkout") {
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const sessionId = typeof body.value.sessionId === "string" ? body.value.sessionId : "";
    const result = await completeCheckout(entitlementDeps(deps), sessionId);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    sendJson(res, 200, { license: result.license, entitlement: result.entitlement });
    return;
  }

  if (method === "POST" && path === "/api/entitlement/status") {
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const license = typeof body.value.license === "string" ? body.value.license : "";
    const result = await readEntitlement(entitlementDeps(deps), license);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    sendJson(res, 200, { entitlement: result.entitlement });
    return;
  }

  if (method === "POST" && path === "/api/entitlement/refresh") {
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const license = typeof body.value.license === "string" ? body.value.license : "";
    const result = await refreshEntitlement(entitlementDeps(deps), license);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    sendJson(res, 200, { license: result.license, entitlement: result.entitlement });
    return;
  }

  if (method === "POST" && path === "/api/portal") {
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const license = typeof body.value.license === "string" ? body.value.license : "";
    const result = await openPortal(
      entitlementDeps(deps),
      license,
      appReturnUrl(config.appUrl, "settings/"),
    );
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    sendJson(res, 200, { url: result.url });
    return;
  }

  if (method === "POST" && path === "/api/recovery/request") {
    if (!deps.recovery) {
      sendError(res, 503, "Recovery is not set up.");
      return;
    }
    // The address limit runs before the body is read: a flood costs nothing.
    const limit = recoveryRateLimiter.take(`recovery:${clientAddress(req)}`);
    if (!limit.ok) {
      sendJson(
        res,
        429,
        { error: "Too many requests. Try again in an hour." },
        { "retry-after": String(limit.retryAfterSeconds) },
      );
      return;
    }
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const email = normaliseEmail(body.value.email);
    if (!email) {
      sendError(res, 400, "Enter the email you used at checkout.");
      return;
    }
    // The answer never varies: subscribed, unknown, failed lookup and failed
    // send all end with the same sentence, so the form cannot be used to test
    // whether an address is a customer.
    await deliverRecoveryLink(deps.recovery, email);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && path === "/api/recovery/redeem") {
    if (!deps.recovery) {
      sendError(res, 503, "Recovery is not set up.");
      return;
    }
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const token = typeof body.value.token === "string" ? body.value.token : "";
    const result = await redeemRecoveryLink(deps.recovery, token);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    sendJson(res, 200, { license: result.license, entitlement: result.entitlement });
    return;
  }

  if (method === "POST" && path === "/v1/chat/completions") {
    if (!deps.proxy) {
      sendError(res, 503, "The system provider is not configured.");
      return;
    }
    // The pass is checked before the body is read: an unauthenticated caller
    // gets a refusal without the service parsing a megabyte for them.
    const license = bearerToken(req);
    if (!license) {
      sendError(res, 401, "The subscription pass is missing, invalid or expired.");
      return;
    }
    const allowed = await readEntitlement(entitlementDeps(deps), license);
    if (!allowed.ok) {
      sendFailure(res, allowed);
      return;
    }
    const address = req.socket.remoteAddress ?? "unknown";
    const limit = rateLimiter.take(licenseKey(license, address));
    if (!limit.ok) {
      sendJson(
        res,
        429,
        { error: "Too many requests. Try again in a little while." },
        { "retry-after": String(limit.retryAfterSeconds) },
      );
      return;
    }
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const result = await proxyChat(deps.proxy, body.value);
    if (!result.ok) {
      const headers: Record<string, string> = result.status === 429 ? { "retry-after": "60" } : {};
      sendJson(res, result.status, { error: result.message }, headers);
      return;
    }
    sendJson(res, 200, result.payload);
    return;
  }

  if (method === "POST" && path === "/api/relay/chat") {
    if (!deps.relay) {
      sendError(res, 503, "The relay is not configured.");
      return;
    }
    // The learner's own key is the only credential here; it arrives as the
    // bearer token and is named into the body, so the browser sends it once.
    const apiKey = bearerToken(req);
    if (!apiKey) {
      sendError(res, 401, "The provider key is missing.");
      return;
    }
    const limit = relayRateLimiter.take(`relay:${clientAddress(req)}`);
    if (!limit.ok) {
      sendJson(
        res,
        429,
        { error: "Too many relayed calls. Try again in a little while." },
        { "retry-after": String(limit.retryAfterSeconds) },
      );
      return;
    }
    const body = await readJsonBody(req, res, MAX_BODY_BYTES);
    if (!body.ok) return;
    const result = await relayChat(deps.relay, { ...body.value, apiKey });
    if (!result.ok) {
      const headers: Record<string, string> = result.status === 429 ? { "retry-after": "60" } : {};
      sendJson(res, result.status, { error: result.message }, headers);
      return;
    }
    sendJson(res, 200, result.payload);
    return;
  }

  if (method === "POST" && path === "/api/stripe/webhook") {
    if (!config.stripeWebhookSecret) {
      sendError(res, 404, "Not found.");
      return;
    }
    const body = await readBody(req, MAX_WEBHOOK_BYTES);
    if (!body.ok) {
      sendError(res, body.tooLarge ? 413 : 400, body.tooLarge ? "The request is too large." : "The request could not be read.");
      return;
    }
    const header = typeof req.headers["stripe-signature"] === "string" ? req.headers["stripe-signature"] : null;
    const checked = verifyStripeSignature(body.text, header, config.stripeWebhookSecret, { now: deps.now?.() });
    if (!checked.ok) {
      sendError(res, 400, "The webhook signature was not valid.");
      return;
    }
    if (checked.event.type.startsWith("customer.subscription.") && checked.event.objectId) {
      deps.subscriptions.invalidate(checked.event.objectId);
      deps.log?.(`[system-provider] webhook ${checked.event.type}; cache cleared`);
    }
    sendJson(res, 200, { received: true });
    return;
  }

  sendError(res, 404, "Not found.");
}

/** Wrap the handler so one failure cannot crash the process or hang a socket. */
export function createRequestHandler(deps: AppDeps): (req: IncomingMessage, res: ServerResponse) => void {
  // One limiter per server, not per request: a fresh map each time would count
  // every call as the first and never refuse anything.
  const ready: AppDeps = {
    ...deps,
    rateLimiter:
      deps.rateLimiter ?? new RateLimiter(deps.config.rateLimitPerHour, undefined, deps.now),
    relayRateLimiter:
      deps.relayRateLimiter ??
      new RateLimiter(deps.config.relayRateLimitPerHour, undefined, deps.now),
    recoveryRateLimiter:
      deps.recoveryRateLimiter ??
      new RateLimiter(deps.config.recovery?.rateLimitPerHour ?? 5, undefined, deps.now),
  };
  return (req, res) => {
    void handleRequest(req, res, ready).catch(() => {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendError(res, 500, "The service had a problem.");
    });
  };
}

/** A ready HTTP server; main.ts listens, tests use port 0. */
export function createSystemServer(deps: AppDeps): Server {
  return createServer(createRequestHandler(deps));
}
