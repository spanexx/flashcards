// WHY: The system provider lives on a small server outside the public page.
// This module is the only place the page talks to it: it knows the public
// address, the pass kept in this browser, and a plain sentence for every
// refusal. No key, price id, or webhook secret ever enters this bundle.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { readErrorSentence } from "@/lib/provider/client";

/** The public facts the settings screen may show. */
export interface SystemPublicConfig {
  name: string;
  priceLabel: string;
  checkout: boolean;
  proxy: boolean;
  recovery: boolean;
}

/**
 * The one answer every address gets. It must not differ for a stranger, or the
 * form would say whether an address buys a subscription.
 */
export const RECOVERY_ANSWER =
  "If that address belongs to a subscription, a link is on its way. The link lasts 30 minutes and works once.";

/** What the settings page says after a link brings the pass back. */
export const RECOVERY_REDEEMED = "Your subscription is active on this browser now.";

/** One live subscription, in the shape the screen shows. Times are epoch seconds. */
export interface SystemEntitlement {
  status: string;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  expiresAt: number;
}

/** A licence answer: the pass to keep plus the entitlement behind it. */
export interface SystemLicenseAnswer {
  license: string;
  entitlement: SystemEntitlement;
}

/** A refusal from the service, or a request that never arrived. Status 0 is the network. */
export class SystemError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SystemError";
    this.status = status;
  }
}

/** How long a pass stays fresh enough without asking; the service uses 7 days too. */
export const LICENSE_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * One request may take this long before it is called a timeout. The free plan
 * sleeps when idle, and waking it can take most of a minute; a shorter wait
 * failed the first call of the day, which looked like a broken service.
 */
const REQUEST_TIMEOUT_MS = 60000;

/** The address is a build fact, never a learner setting. */
const API_BASE = normaliseApiBase(process.env.NEXT_PUBLIC_SYSTEM_API_BASE);
const PROVIDER_NAME = (process.env.NEXT_PUBLIC_SYSTEM_PROVIDER_NAME ?? "").trim();

/** Keep a configured address only when it is a plain http(s) one. */
export function normaliseApiBase(value: string | undefined | null): string {
  const raw = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (raw.length === 0) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? raw : "";
  } catch {
    return "";
  }
}

/** The service address this build was made with; empty means the lane is off. */
export function systemApiBase(): string {
  return API_BASE;
}

/** True when this build names a system provider at all. */
export function systemEnabled(): boolean {
  return API_BASE.length > 0;
}

/** A friendly name for the paid lane, or a plain fallback. */
export function systemProviderName(): string {
  return PROVIDER_NAME.length > 0 ? PROVIDER_NAME : "System provider";
}

/** The base URL a chat call needs: the service answers under /v1. */
export function systemChatBase(base: string = API_BASE): string {
  return base.length > 0 ? `${base}/v1` : "";
}

/** The endpoint shown in settings, or null when the lane is off. */
export function systemProviderEndpoint(): string | null {
  return systemEnabled() ? systemChatBase() : null;
}

/**
 * A pass is worth refreshing when it is close to its end, or already past it.
 * The browser row keeps expiry in milliseconds so it can meet `Date.now`.
 */
export function licenseNeedsRefresh(expiresAtMs: number, nowMs: number = Date.now()): boolean {
  return !Number.isFinite(expiresAtMs) || expiresAtMs - nowMs <= LICENSE_REFRESH_WINDOW_MS;
}

/** Read the public config answer; null when it is not the shape promised. */
export function readSystemConfig(payload: unknown): SystemPublicConfig | null {
  if (payload === null || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim().length === 0) return null;
  return {
    name: record.name.trim(),
    priceLabel: typeof record.priceLabel === "string" ? record.priceLabel.trim() : "",
    checkout: record.checkout === true,
    proxy: record.proxy === true,
    recovery: record.recovery === true,
  };
}

/** Read one entitlement answer; null when it is not the shape promised. */
export function readEntitlement(payload: unknown): SystemEntitlement | null {
  if (payload === null || typeof payload !== "object") return null;
  const record = (payload as { entitlement?: unknown }).entitlement;
  if (record === null || typeof record !== "object") return null;
  const value = record as Record<string, unknown>;
  if (typeof value.status !== "string" || typeof value.expiresAt !== "number") return null;
  if (!Number.isFinite(value.expiresAt)) return null;
  return {
    status: value.status,
    renewsAt:
      typeof value.renewsAt === "number" && Number.isFinite(value.renewsAt) ? value.renewsAt : null,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd === true,
    expiresAt: value.expiresAt,
  };
}

/** Read a licence answer; null when the pass or the entitlement is missing. */
export function readLicenseAnswer(payload: unknown): SystemLicenseAnswer | null {
  if (payload === null || typeof payload !== "object") return null;
  const record = payload as { license?: unknown };
  if (typeof record.license !== "string" || record.license.length === 0) return null;
  const entitlement = readEntitlement(payload);
  return entitlement ? { license: record.license, entitlement } : null;
}

/** Read a redirect answer, keeping only a plain web address. */
export function readUrl(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const value = (payload as { url?: unknown }).url;
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Plain sentence for a failure the service did not explain itself. */
function describeStatus(status: number): string {
  if (status === 401) return "The subscription pass is not valid any more. Refresh it or subscribe again.";
  if (status === 402) return "This subscription is not active.";
  if (status === 404) return "The subscription service has nothing at that address.";
  if (status === 429) return "The subscription service is asking us to slow down. Try again in a moment.";
  if (status >= 500) return "The subscription service had a problem on its side. Try again in a moment.";
  return `The subscription service answered ${status}.`;
}

/** One request with a bounded wait and one plain sentence on failure. */
async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!systemEnabled()) {
    throw new SystemError("This build has no system provider address.", 0);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init.body === undefined ? {} : { "content-type": "application/json" }),
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new SystemError(
        aborted
          ? "The subscription service took too long to answer."
          : "The subscription service could not be reached.",
        0,
      );
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new SystemError(readErrorSentence(payload) ?? describeStatus(response.status), response.status);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

/** Ask the service for its public facts. Never sends a pass. */
export async function fetchSystemConfig(): Promise<SystemPublicConfig> {
  const config = readSystemConfig(await request("/api/config", { method: "GET" }));
  if (!config) {
    throw new SystemError("The subscription service answered in a way this app does not understand.", 0);
  }
  return config;
}

/** Start a Stripe Checkout and return the address the learner must visit. */
export async function startSystemCheckout(): Promise<string> {
  const url = readUrl(await request("/api/checkout", { method: "POST", body: "{}" }));
  if (!url) {
    throw new SystemError("The checkout address was missing. Try again in a moment.", 0);
  }
  return url;
}

/** Exchange a finished Checkout session for a pass. */
export async function completeSystemCheckout(sessionId: string): Promise<SystemLicenseAnswer> {
  const answer = readLicenseAnswer(
    await request("/api/entitlement/checkout", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
  );
  if (!answer) {
    throw new SystemError("The checkout finished, but no subscription pass came back.", 0);
  }
  return answer;
}

/** Read the live entitlement behind a pass. */
export async function readSystemStatus(license: string): Promise<SystemEntitlement> {
  const entitlement = readEntitlement(
    await request("/api/entitlement/status", {
      method: "POST",
      body: JSON.stringify({ license }),
    }),
  );
  if (!entitlement) {
    throw new SystemError("The subscription service answered in a way this app does not understand.", 0);
  }
  return entitlement;
}

/** Re-sign a still-live pass before it runs out. */
export async function refreshSystemLicense(license: string): Promise<SystemLicenseAnswer> {
  const answer = readLicenseAnswer(
    await request("/api/entitlement/refresh", {
      method: "POST",
      body: JSON.stringify({ license }),
    }),
  );
  if (!answer) {
    throw new SystemError("The subscription pass could not be refreshed.", 0);
  }
  return answer;
}

/** Open the billing portal and return its address. */
export async function openSystemPortal(license: string): Promise<string> {
  const url = readUrl(
    await request("/api/portal", {
      method: "POST",
      body: JSON.stringify({ license }),
    }),
  );
  if (!url) {
    throw new SystemError("The billing portal address was missing. Try again in a moment.", 0);
  }
  return url;
}

/** Ask the service to mail a recovery link. A stranger and a subscriber hear the same thing. */
export async function requestRecovery(email: string): Promise<void> {
  await request("/api/recovery/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Trade a recovery link for a fresh pass in this browser. */
export async function redeemRecovery(token: string): Promise<SystemLicenseAnswer> {
  const answer = readLicenseAnswer(
    await request("/api/recovery/redeem", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
  if (!answer) {
    throw new SystemError("The link was accepted, but no subscription pass came back.", 0);
  }
  return answer;
}
