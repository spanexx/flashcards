// WHY: A public webhook address is an invitation. Only the signature decides
// whether the call may clear a cached subscription; the body is never trusted
// for access. These tests pin that boundary, including the clock window.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "../server/src/webhook";

const SECRET = "whsec_test";
const NOW = 1_800_000_000_000;
const body = JSON.stringify({
  id: "evt_1",
  type: "customer.subscription.deleted",
  data: { object: { id: "sub_1" } },
});

function header(at: number, secret = SECRET, signature?: string): string {
  const digest =
    signature ?? createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");
  return `t=${at},v1=${digest}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a fresh signature and reads only the event identity", () => {
    const result = verifyStripeSignature(body, header(NOW / 1000), SECRET, { now: NOW });
    expect(result).toEqual({
      ok: true,
      event: { id: "evt_1", type: "customer.subscription.deleted", objectId: "sub_1" },
    });
  });

  it("accepts one valid signature among several", () => {
    const good = createHmac("sha256", SECRET).update(`${NOW / 1000}.${body}`).digest("hex");
    const mixed = `t=${NOW / 1000},v1=${"0".repeat(64)},v1=${good}`;
    expect(verifyStripeSignature(body, mixed, SECRET, { now: NOW }).ok).toBe(true);
  });

  it("refuses a missing header", () => {
    expect(verifyStripeSignature(body, null, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("refuses a header without a timestamp or signature", () => {
    expect(verifyStripeSignature(body, "v1=abc", SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyStripeSignature(body, "t=1800000000", SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyStripeSignature(body, "t=soon,v1=abc", SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("refuses a signature made with another secret", () => {
    expect(
      verifyStripeSignature(body, header(NOW / 1000, "whsec_other"), SECRET, { now: NOW }),
    ).toEqual({ ok: false, reason: "signature" });
  });

  it("refuses a body edited after signing", () => {
    const signed = header(NOW / 1000);
    const edited = body.replace("sub_1", "sub_2");
    expect(verifyStripeSignature(edited, signed, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("refuses an old or far-future timestamp", () => {
    const old = header((NOW - 301_000) / 1000);
    expect(verifyStripeSignature(body, old, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "stale",
    });
    const future = header((NOW + 301_000) / 1000);
    expect(verifyStripeSignature(body, future, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("refuses signed text that is not a usable event", () => {
    const at = NOW / 1000;
    const broken = "{not json";
    const signed = `t=${at},v1=${createHmac("sha256", SECRET).update(`${at}.${broken}`).digest("hex")}`;
    expect(verifyStripeSignature(broken, signed, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "json",
    });
    const empty = JSON.stringify({ id: "evt_1" });
    const signedEmpty = `t=${at},v1=${createHmac("sha256", SECRET).update(`${at}.${empty}`).digest("hex")}`;
    expect(verifyStripeSignature(empty, signedEmpty, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "json",
    });
  });
});
