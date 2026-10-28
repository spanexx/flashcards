// WHY: The browser must prove it paid without holding the Stripe key. A compact
// HMAC-signed pass does that: the server can verify it with one secret, it
// carries only ids and dates, and it cannot be forged or edited by the browser.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { createHmac, timingSafeEqual } from "node:crypto";

/** The facts a license carries. No key, email or learner text. */
export interface LicensePayload {
  v: 1;
  sub: string;
  cus: string;
  iat: number;
  exp: number;
}

/** Why a token was refused, so the route can choose a status without guessing. */
export type LicenseFailure = "malformed" | "signature" | "expired";

export type LicenseResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: LicenseFailure };

/** The app refreshes a license this long before it expires. */
export const REFRESH_WINDOW_SECONDS = 7 * 24 * 60 * 60;

/** One base64url signature over the exact payload text. */
function sign(payloadText: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadText).digest("base64url");
}

/** Sign a payload and return the token the browser stores. */
export function signLicense(payload: LicensePayload, secret: string): string {
  const payloadText = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadText}.${sign(payloadText, secret)}`;
}

/** Issue a license for one subscription and customer. */
export function issueLicense(
  ids: { sub: string; cus: string },
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): { token: string; payload: LicensePayload } {
  const iat = Math.floor(now / 1000);
  const payload: LicensePayload = {
    v: 1,
    sub: ids.sub,
    cus: ids.cus,
    iat,
    exp: iat + Math.max(1, Math.floor(ttlSeconds)),
  };
  return { token: signLicense(payload, secret), payload };
}

/** Read the payload without trusting it; null when the text is not a payload. */
function readPayload(text: string): LicensePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(text, "base64url").toString("utf8")) as unknown;
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (record.v !== 1) return null;
    if (typeof record.sub !== "string" || record.sub.length === 0) return null;
    if (typeof record.cus !== "string" || record.cus.length === 0) return null;
    if (typeof record.iat !== "number" || !Number.isFinite(record.iat)) return null;
    if (typeof record.exp !== "number" || !Number.isFinite(record.exp)) return null;
    if (!Number.isInteger(record.iat) || !Number.isInteger(record.exp)) return null;
    if (record.exp <= record.iat) return null;
    return { v: 1, sub: record.sub, cus: record.cus, iat: record.iat, exp: record.exp };
  } catch {
    return null;
  }
}

/**
 * Verify a token. Signature first, then the version, then the date, so a forged
 * token learns nothing about expiry. `allowExpired` exists only for the refresh
 * route, which still asks Stripe for a live subscription before re-signing.
 */
export function verifyLicense(
  token: string,
  secret: string,
  options: { now?: number; allowExpired?: boolean } = {},
): LicenseResult {
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { ok: false, reason: "malformed" };
  }
  const [payloadText, signature] = parts;
  const expected = Buffer.from(sign(payloadText, secret), "utf8");
  const presented = Buffer.from(signature, "utf8");
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) {
    return { ok: false, reason: "signature" };
  }

  // A signed token with an unknown version is still unusable: the shape check
  // above already refuses anything but version 1, which keeps old passes out.
  const payload = readPayload(payloadText);
  if (!payload) return { ok: false, reason: "malformed" };

  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  if (!options.allowExpired && nowSeconds >= payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

/** True when fewer than the refresh window remains. */
export function needsRefresh(payload: LicensePayload, now: number = Date.now()): boolean {
  return payload.exp - Math.floor(now / 1000) < REFRESH_WINDOW_SECONDS;
}
