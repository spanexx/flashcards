// WHY: A paid pass lives in one browser, and clearing site data or moving to a
// new machine loses it. Stripe already holds the email and the live
// subscription, so this module turns that record into a short link and back
// into a fresh pass, without storing the address anywhere.
// PACK: subscription-recovery
// 2026-10-28 qoder: created to move a paid pass to a new browser. [pack: subscription-recovery]

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { entitlementView, type EntitlementResult } from "./entitlement";
import { issueLicense } from "./license";
import type { RecoveryMailer } from "./mailer";
import { grantsAccess } from "./subscriptions";
import type { StripeClient, StripeSubscriptionView } from "./stripe";

/** What a link carries: the address the learner paid with and when it was asked for. */
export interface RecoveryTokenPayload {
  v: 1;
  email: string;
  iat: number;
}

/** Why a link was refused. A forged link and an old link are told apart. */
export type RecoveryTokenFailure = "invalid" | "expired";

export type RecoveryTokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: RecoveryTokenFailure };

/** The address shape this flow accepts: one @, a dot after it, no spaces. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 320;

/** Trim and keep only a plain address; null when it is not one. */
export function isPlainEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_EMAIL_LENGTH && EMAIL.test(trimmed);
}

export function normaliseEmail(value: unknown): string | null {
  return isPlainEmail(value) ? (value as string).trim() : null;
}

/** One base64url signature over the exact payload text. */
function sign(payloadText: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadText).digest("base64url");
}

/** The in-memory key for the per-address cooldown. The address itself is never kept. */
export function recoveryHash(email: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${email.trim().toLowerCase()}`).digest("hex");
}

/** Sign a 30-minute link token for one address. */
export function signRecoveryToken(email: string, secret: string, now: number = Date.now()): string {
  const payload: RecoveryTokenPayload = { v: 1, email, iat: Math.floor(now / 1000) };
  const payloadText = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadText}.${sign(payloadText, secret)}`;
}

/** Read a link token: signature first, then version, then its age. */
export function verifyRecoveryToken(
  token: string,
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): RecoveryTokenResult {
  const text = typeof token === "string" ? token.trim() : "";
  const parts = text.split(".");
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { ok: false, reason: "invalid" };
  }
  const expected = Buffer.from(sign(parts[0], secret), "utf8");
  const given = Buffer.from(parts[1], "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "invalid" };
  }

  let payload: RecoveryTokenPayload | null = null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as unknown;
    if (parsed !== null && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const email = normaliseEmail(record.email);
      if (record.v === 1 && email && Number.isInteger(record.iat) && (record.iat as number) > 0) {
        payload = { v: 1, email, iat: record.iat as number };
      }
    }
  } catch {
    payload = null;
  }
  if (!payload) return { ok: false, reason: "invalid" };

  const nowSeconds = Math.floor(now / 1000);
  if (payload.iat > nowSeconds + 60) return { ok: false, reason: "invalid" };
  if (nowSeconds - payload.iat > Math.max(1, Math.floor(ttlSeconds))) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, email: payload.email };
}

/** The live subscription that should back a recovered pass. */
export function pickLiveSubscription(
  subscriptions: readonly StripeSubscriptionView[],
): StripeSubscriptionView | null {
  let best: StripeSubscriptionView | null = null;
  for (const subscription of subscriptions) {
    if (!grantsAccess(subscription.status)) continue;
    if (!best || (subscription.renewsAt ?? 0) > (best.renewsAt ?? 0)) best = subscription;
  }
  return best;
}

/** One request per address per window, remembered as a hash, gone on restart. */
export class RecoveryCooldown {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** True when this hash may ask now; the moment is recorded either way. */
  take(hash: string): boolean {
    const at = this.now();
    const last = this.seen.get(hash);
    const allowed = last === undefined || at - last >= this.windowMs;
    if (allowed) this.seen.set(hash, at);
    if (this.seen.size > 10_000) this.sweep(at);
    return allowed;
  }

  /** How many addresses are remembered; tests use it, operators do not. */
  size(): number {
    return this.seen.size;
  }

  private sweep(at: number): void {
    for (const [hash, seenAt] of this.seen) {
      if (at - seenAt >= this.windowMs) this.seen.delete(hash);
    }
  }
}

/** The fixed pieces a recovery request needs. The cooldown joins them per server. */
export interface RecoverySettings {
  stripe: Pick<StripeClient, "listCustomersByEmail" | "listCustomerSubscriptions">;
  mailer: RecoveryMailer;
  secret: string;
  appUrl: string;
  tokenTtlSeconds: number;
  licenseSecret: string;
  licenseTtlSeconds: number;
  log?: (line: string) => void;
}

/** Everything one recovery call needs. */
export interface RecoveryDeps extends RecoverySettings {
  cooldown: RecoveryCooldown;
  now?: () => number;
}

/**
 * Stripe's customer email filter is an exact match, and the case a person types
 * at checkout is not guaranteed to be the case they type later. Both forms are
 * tried, so a learner who capitalises their address differently is not locked
 * out by a detail they cannot see.
 */
function emailForms(email: string): string[] {
  const trimmed = email.trim();
  const lower = trimmed.toLowerCase();
  return trimmed === lower ? [trimmed] : [trimmed, lower];
}

/** Every customer Stripe knows under either form of the address, once each. */
async function findCustomers(
  stripe: RecoverySettings["stripe"],
  email: string,
): Promise<{ id: string }[]> {
  const found = new Map<string, { id: string }>();
  for (const form of emailForms(email)) {
    for (const customer of await stripe.listCustomersByEmail(form)) {
      if (customer.id.length > 0) found.set(customer.id, customer);
    }
  }
  return [...found.values()];
}

/** The live subscription behind an address, or null. Throws only on Stripe failure. */
async function findLiveSubscription(
  stripe: RecoverySettings["stripe"],
  email: string,
): Promise<StripeSubscriptionView | null> {
  const subscriptions: StripeSubscriptionView[] = [];
  for (const customer of await findCustomers(stripe, email)) {
    subscriptions.push(...(await stripe.listCustomerSubscriptions(customer.id)));
  }
  return pickLiveSubscription(subscriptions);
}

/** The link a learner opens in the browser that should receive the pass. */
export function recoveryLink(appUrl: string, token: string): string {
  const url = new URL("settings/", appUrl.endsWith("/") ? appUrl : `${appUrl}/`);
  url.searchParams.set("recover", token);
  return url.toString();
}

/**
 * Do the work behind the one fixed answer. It never throws and never says what
 * it found: a miss, a Stripe failure and a mail failure all end here.
 */
export async function deliverRecoveryLink(deps: RecoveryDeps, email: string): Promise<void> {
  const now = deps.now ?? Date.now;
  if (!deps.cooldown.take(recoveryHash(email, deps.secret))) return;

  let subscription: StripeSubscriptionView | null = null;
  try {
    subscription = await findLiveSubscription(deps.stripe, email);
  } catch {
    deps.log?.("[system-provider] recovery lookup failed");
    return;
  }
  if (!subscription) return;

  const token = signRecoveryToken(email, deps.secret, now());
  try {
    await deps.mailer.sendRecoveryLink(email, recoveryLink(deps.appUrl, token), deps.tokenTtlSeconds);
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
    deps.log?.(`[system-provider] recovery send failed; mailer answered ${status}`);
  }
}

const EXPIRED_LINK = {
  ok: false as const,
  code: "invalid_license" as const,
  message: "That link has expired. Ask for a new one.",
};

const INVALID_LINK = {
  ok: false as const,
  code: "invalid_license" as const,
  message: "That link is not valid. Ask for a new one.",
};

const INACTIVE = {
  ok: false as const,
  code: "inactive" as const,
  message: "This subscription is not active.",
};

const STRIPE_FAILED = {
  ok: false as const,
  code: "stripe" as const,
  message: "The subscription service could not check the payment. Try again in a moment.",
};

/**
 * Turn a link back into a pass. The live subscription is re-read from Stripe on
 * every redemption, so a link sent before a cancellation buys nothing.
 */
export async function redeemRecoveryLink(
  deps: RecoveryDeps,
  token: string,
): Promise<EntitlementResult> {
  const now = deps.now ?? Date.now;
  const read = verifyRecoveryToken(token, deps.secret, deps.tokenTtlSeconds, now());
  if (!read.ok) return read.reason === "expired" ? EXPIRED_LINK : INVALID_LINK;

  let subscription: StripeSubscriptionView | null;
  try {
    subscription = await findLiveSubscription(deps.stripe, read.email);
  } catch {
    return STRIPE_FAILED;
  }
  if (!subscription || !subscription.customer) return INACTIVE;

  const issued = issueLicense(
    { sub: subscription.id, cus: subscription.customer },
    deps.licenseSecret,
    deps.licenseTtlSeconds,
    now(),
  );
  return {
    ok: true,
    entitlement: entitlementView(subscription, issued.payload.exp),
    license: issued.token,
  };
}
