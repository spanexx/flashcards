// WHY: The license is the only thing between a stranger and the operator's
// paid model key. These tests pin its signature, version and expiry rules.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { describe, expect, it } from "vitest";
import {
  issueLicense,
  needsRefresh,
  REFRESH_WINDOW_SECONDS,
  signLicense,
  verifyLicense,
  type LicensePayload,
} from "../server/src/license";

const SECRET = "license-secret-that-is-long-enough-123";
const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const DAY = 24 * 60 * 60;

const payload: LicensePayload = {
  v: 1,
  sub: "sub_123",
  cus: "cus_123",
  iat: Math.floor(NOW / 1000),
  exp: Math.floor(NOW / 1000) + 30 * DAY,
};

describe("license", () => {
  it("issues a token that verifies and carries the same facts", () => {
    const issued = issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, 30 * DAY, NOW);
    const read = verifyLicense(issued.token, SECRET, { now: NOW });
    expect(read).toEqual({ ok: true, payload: issued.payload });
    expect(issued.payload.iat).toBe(Math.floor(NOW / 1000));
    expect(issued.payload.exp).toBe(Math.floor(NOW / 1000) + 30 * DAY);
  });

  it("refuses a payload edited after signing", () => {
    const token = signLicense(payload, SECRET);
    const [payloadText, signature] = token.split(".");
    const edited = Buffer.from(
      JSON.stringify({ ...payload, exp: payload.exp + 99 * DAY }),
      "utf8",
    ).toString("base64url");
    expect(verifyLicense(`${edited}.${signature}`, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "signature",
    });
    expect(payloadText.length).toBeGreaterThan(0);
  });

  it("refuses a signature signed with another secret", () => {
    const token = signLicense(payload, "another-secret-that-is-long-enough");
    expect(verifyLicense(token, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("refuses a token with a broken signature shape", () => {
    const token = signLicense(payload, SECRET);
    expect(verifyLicense(token.replace(/\.[^.]+$/, ".x"), SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "signature",
    });
    expect(verifyLicense("", SECRET, { now: NOW })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyLicense("no-dot", SECRET, { now: NOW })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyLicense("a.b.c", SECRET, { now: NOW })).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses an expired token but lets the refresh route inspect it", () => {
    const token = signLicense(payload, SECRET);
    const after = NOW + 31 * DAY * 1000;
    expect(verifyLicense(token, SECRET, { now: after })).toEqual({ ok: false, reason: "expired" });
    expect(verifyLicense(token, SECRET, { now: after, allowExpired: true })).toEqual({
      ok: true,
      payload,
    });
  });

  it("refuses a payload with an unusable version or dates", () => {
    const wrongVersion = signLicense({ ...payload, v: 2 as unknown as 1 }, SECRET);
    expect(verifyLicense(wrongVersion, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    const backwards = signLicense({ ...payload, exp: payload.iat }, SECRET);
    expect(verifyLicense(backwards, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    const missing = signLicense({ ...payload, sub: "" }, SECRET);
    expect(verifyLicense(missing, SECRET, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("knows when the refresh window has arrived", () => {
    const almost = { ...payload, exp: Math.floor(NOW / 1000) + REFRESH_WINDOW_SECONDS - 1 };
    const far = { ...payload, exp: Math.floor(NOW / 1000) + REFRESH_WINDOW_SECONDS + 1 };
    expect(needsRefresh(almost, NOW)).toBe(true);
    expect(needsRefresh(far, NOW)).toBe(false);
  });
});
