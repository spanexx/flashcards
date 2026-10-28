// WHY: Anyone can POST to a webhook address. The signature header is what makes
// the call Stripe's: an HMAC over the exact raw body and its timestamp. Only
// the subscription id is read, and only to drop a cached status, never to grant.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { createHmac, timingSafeEqual } from "node:crypto";

/** The small part of a Stripe event this service acts on. */
export interface StripeEvent {
  id: string;
  type: string;
  objectId: string | null;
}

export type WebhookResult =
  | { ok: true; event: StripeEvent }
  | { ok: false; reason: "missing" | "malformed" | "signature" | "stale" | "json" };

/** Five minutes is Stripe's own recommended tolerance. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Split `t=...,v1=...` into the timestamp and every signature offered. */
function readHeader(header: string): { at: number; signatures: string[] } | null {
  const at: number[] = [];
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name === "t" && /^\d+$/.test(value)) at.push(Number(value));
    if (name === "v1" && value.length > 0) signatures.push(value);
  }
  if (at.length !== 1 || signatures.length === 0) return null;
  return { at: at[0], signatures };
}

/**
 * Verify a Stripe-Signature header against the raw request body. The raw text
 * matters: parsing and re-encoding JSON would change the bytes Stripe signed.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  options: { now?: number; toleranceSeconds?: number } = {},
): WebhookResult {
  if (!header) return { ok: false, reason: "missing" };
  const parsedHeader = readHeader(header);
  if (!parsedHeader) return { ok: false, reason: "malformed" };

  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const tolerance = options.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(now - parsedHeader.at) > tolerance) return { ok: false, reason: "stale" };

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${parsedHeader.at}.${rawBody}`).digest("hex"),
    "utf8",
  );
  let matched = false;
  for (const signature of parsedHeader.signatures) {
    const presented = Buffer.from(signature, "utf8");
    if (presented.length === expected.length && timingSafeEqual(presented, expected)) matched = true;
  }
  if (!matched) return { ok: false, reason: "signature" };

  let event: unknown = null;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch {
    return { ok: false, reason: "json" };
  }
  if (!event || typeof event !== "object") return { ok: false, reason: "json" };
  const record = event as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const type = typeof record.type === "string" ? record.type : "";
  if (id.length === 0 || type.length === 0) return { ok: false, reason: "json" };
  const data = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
  const object = data.object && typeof data.object === "object" ? (data.object as Record<string, unknown>) : {};
  return {
    ok: true,
    event: {
      id,
      type,
      objectId: typeof object.id === "string" && object.id.length > 0 ? object.id : null,
    },
  };
}
