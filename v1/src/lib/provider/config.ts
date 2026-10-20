// WHY: The endpoint and model are read at call time, never at import time, so
// a learner's settings file is honoured even though the modules loaded first.
// On WSL a loopback provider is swapped for the host address because WSL's
// loopback is not the host's loopback.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: ProviderConfig moved to provider/types.ts so the browser
// lane can import the type without the file-backed config. [pack: browser-app]

import "server-only";
import { readFile } from "node:fs/promises";
import type { ProviderStatus } from "@/lib/shared/types";
import { readSettings } from "@/lib/core/settings";
import { KEY_STORE_NAMES, keyStore } from "@/lib/provider/keystore";
import type { ProviderConfig } from "@/lib/provider/types";

export type { ProviderConfig };

/** True when this process is running inside WSL. */
export async function isWsl(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf8");
    return /microsoft|wsl/i.test(version);
  } catch {
    return false;
  }
}

/**
 * Pick the default gateway out of /proc/net/route. The gateway field is
 * little-endian hex, so the bytes are reversed before they become an address.
 * Exported for tests, which feed it fixture text instead of a real kernel.
 */
export function parseDefaultGateway(routeText: string): string | null {
  for (const line of routeText.split("\n").slice(1)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 4) continue;
    const destination = fields[1];
    const gateway = fields[2];
    if (destination !== "00000000" || !/^[0-9a-fA-F]{8}$/.test(gateway)) continue;
    const bytes = gateway.match(/../g) ?? [];
    if (bytes.length !== 4) continue;
    return bytes.reverse().map((byte) => parseInt(byte, 16)).join(".");
  }
  return null;
}

/**
 * The host address WSL can reach. The kernel's default gateway is the honest
 * answer; older WSL setups only put it in the resolv file, so that is the
 * fallback. On WSL 2 with mirrored DNS the nameserver can be a NAT proxy
 * (10.255.255.254) that is not the host at all.
 */
export async function wslHostAddress(): Promise<string | null> {
  try {
    const routes = await readFile("/proc/net/route", "utf8");
    const gateway = parseDefaultGateway(routes);
    if (gateway) return gateway;
  } catch {
    // Not on Linux, or the kernel table is unreadable; try the fallback.
  }
  try {
    const resolv = await readFile("/etc/resolv.conf", "utf8");
    const match = resolv.match(/^\s*nameserver\s+(\S+)/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** True when a URL points at this machine's own loopback. */
export function pointsAtLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

/** Replace a loopback host with the WSL host address. Pure and testable. */
export function swapLoopbackForHost(
  url: string,
  host: string | null,
): { url: string; swapped: boolean } {
  if (!host || !pointsAtLoopback(url)) return { url, swapped: false };
  try {
    const parsed = new URL(url);
    parsed.hostname = host;
    return { url: parsed.toString(), swapped: true };
  } catch {
    return { url, swapped: false };
  }
}

/** Resolve endpoint, model and key for one call, with the WSL swap applied. */
export async function getProviderConfig(): Promise<
  { ok: true; config: ProviderConfig } | { ok: false; message: string }
> {
  const settings = await readSettings();
  const url = (process.env.FLASHCARDS_PROVIDER_URL ?? settings.provider.url).trim();
  const model = (process.env.FLASHCARDS_PROVIDER_MODEL ?? settings.provider.model).trim();
  if (url.length === 0 || model.length === 0) {
    return { ok: false, message: "No provider is set up. The app works without one." };
  }

  const key = await keyStore.getKey();
  if (!key) {
    return {
      ok: false,
      message: "A provider is set up but no key is stored. Add a key in settings.",
    };
  }

  let finalUrl = url;
  let swappedForWsl = false;
  if (await isWsl()) {
    const swapped = swapLoopbackForHost(url, await wslHostAddress());
    finalUrl = swapped.url;
    swappedForWsl = swapped.swapped;
  }

  return { ok: true, config: { url: finalUrl, model, key, swappedForWsl } };
}

/** Provider state in plain words. The key itself never appears here. */
export async function providerStatus(): Promise<ProviderStatus> {
  const settings = await readSettings();
  const url = (process.env.FLASHCARDS_PROVIDER_URL ?? settings.provider.url).trim();
  const model = (process.env.FLASHCARDS_PROVIDER_MODEL ?? settings.provider.model).trim();
  const store = await keyStore.status();

  const swapped = (await isWsl()) ? swapLoopbackForHost(url, await wslHostAddress()).swapped : false;
  const configured = url.length > 0 && model.length > 0;
  let message = "Provider ready.";
  if (!configured) message = "No provider is set up. The app works without one.";
  else if (!store.hasKey) message = "A provider is set up but no key is stored. Add a key in settings.";

  return {
    configured,
    hasKey: store.hasKey,
    endpoint: url.length > 0 ? url : null,
    model: model.length > 0 ? model : null,
    keyStore: store.kind,
    swappedForWsl: swapped,
    message,
  };
}

/** The plain name of the store currently holding the key. */
export async function keyStoreName(): Promise<string> {
  const store = await keyStore.status();
  return KEY_STORE_NAMES[store.kind];
}
