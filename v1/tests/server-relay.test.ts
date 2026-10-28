// WHY: The relay is an open door to the network, so every refusal here is a
// promise that the box cannot be pointed at a private address, a redirect, or
// an endpoint that is not a chat. The sends are fakes; the decisions are real.
// PACK: provider-relay
// 2026-10-28 qoder: created for the learner's own provider relay. [pack: provider-relay]

import { describe, expect, it, vi } from "vitest";
import { MAX_REPLY_CHARS } from "../server/src/proxy";
import {
  privateAddress,
  readRelayRequest,
  readRelayUrl,
  RelayReplyTooLargeError,
  RelayTimeoutError,
  relayChat,
  resolveTarget,
  type PinnedTarget,
  type RelayAddress,
  type RelayOptions,
  type RelaySend,
} from "../server/src/relay";

const KEY = "sk-learner-own-key";
const URL_OK = "https://llm.example/v1/chat/completions";

function body(extra: Record<string, unknown> = {}) {
  return {
    url: URL_OK,
    model: "learner-model",
    apiKey: KEY,
    messages: [{ role: "user", content: "Say OK." }],
    ...extra,
  };
}

function options(
  send: RelaySend,
  lookup: (hostname: string) => Promise<RelayAddress[]> = async () => [
    { address: "93.184.216.34", family: 4 },
  ],
): RelayOptions {
  return { timeoutMs: 1_000, lookup, send };
}

/** A fake sender that answers once and records every target it was handed. */
function sender(answer: { status: number; text: string } | Error) {
  const seen: PinnedTarget[] = [];
  const bodies: string[] = [];
  const send: RelaySend = async (target, text) => {
    seen.push(target);
    bodies.push(text);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { send, seen, bodies };
}

const okReply = { status: 200, text: JSON.stringify({ choices: [{ message: { content: "OK" } }] }) };

describe("readRelayUrl", () => {
  it("accepts only a secure chat endpoint on the standard port", () => {
    expect(readRelayUrl(URL_OK)).toMatchObject({ ok: true });
    expect(readRelayUrl("https://llm.example/v1/chat/completions?x=1")).toMatchObject({ ok: true });
    expect(readRelayUrl("https://llm.example:443/v1/chat/completions")).toMatchObject({ ok: true });
  });

  it("refuses plain http", () => {
    expect(readRelayUrl("http://llm.example/v1/chat/completions")).toMatchObject({ ok: false });
  });

  it("refuses a non-standard port", () => {
    expect(readRelayUrl("https://llm.example:8443/v1/chat/completions")).toMatchObject({ ok: false });
  });

  it("refuses a username or password in the address", () => {
    expect(readRelayUrl("https://user:pass@llm.example/v1/chat/completions")).toMatchObject({
      ok: false,
    });
  });

  it("refuses anything that is not a chat-completions path", () => {
    expect(readRelayUrl("https://llm.example/v1/models")).toMatchObject({ ok: false });
    expect(readRelayUrl("https://llm.example/v1/chat/completions/")).toMatchObject({ ok: false });
    expect(readRelayUrl("https://llm.example/")).toMatchObject({ ok: false });
  });

  it("refuses text that is not an address at all", () => {
    expect(readRelayUrl("not a url")).toMatchObject({ ok: false });
    expect(readRelayUrl("   ")).toMatchObject({ ok: false });
  });

  it("drops the fragment so it never travels upstream", () => {
    const read = readRelayUrl(`${URL_OK}#secret`);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.url.hash).toBe("");
  });
});

describe("readRelayRequest", () => {
  it("keeps the address, model and messages, and the learner's key", () => {
    const read = readRelayRequest(body({ temperature: 0.7 }));
    expect(read).toMatchObject({
      ok: true,
      request: {
        model: "learner-model",
        apiKey: KEY,
        messages: [{ role: "user", content: "Say OK." }],
        temperature: 0.7,
      },
    });
  });

  it("refuses a request with no key before any network work", () => {
    expect(readRelayRequest(body({ apiKey: "" }))).toMatchObject({ ok: false });
    expect(readRelayRequest(body({ apiKey: "has\r\nnewline" }))).toMatchObject({ ok: false });
  });

  it("refuses a missing model, a missing address and a bad message list", () => {
    expect(readRelayRequest(body({ model: "" }))).toMatchObject({ ok: false });
    expect(readRelayRequest(body({ url: "" }))).toMatchObject({ ok: false });
    expect(readRelayRequest(body({ messages: [] }))).toMatchObject({ ok: false });
    expect(readRelayRequest(body({ messages: [{ role: "tool", content: "x" }] }))).toMatchObject({
      ok: false,
    });
    expect(readRelayRequest(null)).toMatchObject({ ok: false });
  });
});

describe("privateAddress", () => {
  it("names every IPv4 range the relay must never call", () => {
    const blocked = [
      "0.0.0.0",
      "10.1.2.3",
      "127.0.0.1",
      "100.64.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
      "192.0.0.1",
      "192.2.0.1",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.7",
      "224.0.0.1",
      "255.255.255.255",
      "not-an-address",
    ];
    for (const address of blocked) expect(privateAddress(address)).toBe(true);
  });

  it("allows ordinary public IPv4", () => {
    for (const address of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "11.0.0.1"]) {
      expect(privateAddress(address)).toBe(false);
    }
  });

  it("names every IPv6 range the relay must never call", () => {
    const blocked = [
      "::",
      "::1",
      "::ffff:10.0.0.1",
      "::ffff:0a00:0001",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "febf::1",
      "ff02::1",
      "2001:db8::1",
    ];
    for (const address of blocked) expect(privateAddress(address)).toBe(true);
  });

  it("allows an ordinary public IPv6 and strips the URL brackets", () => {
    expect(privateAddress("2606:4700:4700::1111")).toBe(false);
    expect(privateAddress("[2606:4700:4700::1111]")).toBe(false);
  });
});

describe("resolveTarget", () => {
  it("refuses localhost and internal names without asking DNS", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    for (const name of ["localhost", "api.localhost", "printer.local", "db.internal", "x.home.arpa", "nas.lan"]) {
      await expect(resolveTarget(name, lookup)).resolves.toMatchObject({ ok: false, kind: "refused" });
    }
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses a private IP literal without asking DNS", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    await expect(resolveTarget("10.0.0.5", lookup)).resolves.toMatchObject({ ok: false, kind: "refused" });
    await expect(resolveTarget("[::1]", lookup)).resolves.toMatchObject({ ok: false, kind: "refused" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses a name that only resolves to private addresses", async () => {
    const lookup = async () => [
      { address: "10.0.0.5", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expect(resolveTarget("rebel.example", lookup)).resolves.toMatchObject({
      ok: false,
      kind: "refused",
    });
  });

  it("keeps only the public answers and sends them as bare addresses", async () => {
    const lookup = async () => [
      { address: "10.0.0.5", family: 4 },
      { address: "93.184.216.34", family: 4 },
    ];
    await expect(resolveTarget("mixed.example", lookup)).resolves.toEqual({
      ok: true,
      addresses: ["93.184.216.34"],
    });
  });

  it("reports a name that cannot be found", async () => {
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(resolveTarget("gone.example", lookup)).resolves.toMatchObject({
      ok: false,
      kind: "dns",
    });
  });
});

describe("relayChat", () => {
  it("forwards one call pinned to the checked address", async () => {
    const fake = sender(okReply);
    const result = await relayChat(options(fake.send), body());

    expect(result).toEqual({ ok: true, payload: { choices: [{ message: { content: "OK" } }] } });
    expect(fake.seen).toEqual([
      {
        address: "93.184.216.34",
        hostHeader: "llm.example",
        servername: "llm.example",
        path: "/v1/chat/completions",
        apiKey: KEY,
      },
    ]);
    expect(JSON.parse(fake.bodies[0])).toEqual({
      model: "learner-model",
      messages: [{ role: "user", content: "Say OK." }],
      temperature: 0.2,
    });
  });

  it("keeps no servername for an IP literal and preserves the port in Host", async () => {
    const fake = sender(okReply);
    await relayChat(
      options(fake.send, async () => [{ address: "93.184.216.34", family: 4 }]),
      body({ url: "https://93.184.216.34/v1/chat/completions" }),
    );
    expect(fake.seen[0].servername).toBeNull();
    expect(fake.seen[0].hostHeader).toBe("93.184.216.34");
  });

  it("refuses a request without a key before DNS or a send", async () => {
    const fake = sender(okReply);
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const result = await relayChat(options(fake.send, lookup), body({ apiKey: "" }));
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(lookup).not.toHaveBeenCalled();
    expect(fake.seen).toHaveLength(0);
  });

  it("refuses a private target before a send", async () => {
    const fake = sender(okReply);
    const privateName = await relayChat(
      options(fake.send, async () => [{ address: "192.168.1.9", family: 4 }]),
      body(),
    );
    expect(privateName).toMatchObject({ ok: false, status: 400 });
    expect(fake.seen).toHaveLength(0);
  });

  it("does not follow a redirect", async () => {
    const fake = sender({ status: 302, text: "" });
    const result = await relayChat(options(fake.send), body());
    expect(result).toMatchObject({ ok: false, status: 502 });
    if (result.ok) return;
    expect(result.message).toContain("redirect");
  });

  it("turns a busy provider into 429", async () => {
    const fake = sender({ status: 429, text: "" });
    await expect(relayChat(options(fake.send), body())).resolves.toMatchObject({
      ok: false,
      status: 429,
    });
  });

  it("surfaces a rejected key and a missing endpoint with a plain sentence", async () => {
    const rejected = await relayChat(options(sender({ status: 401, text: "" }).send), body());
    expect(rejected).toMatchObject({ ok: false, status: 401 });
    if (!rejected.ok) expect(rejected.message).toContain("key");

    const missing = sender({ status: 404, text: "" });
    const result = await relayChat(options(missing.send), body());
    expect(result).toMatchObject({ ok: false, status: 404 });
    if (!result.ok) expect(result.message).toContain(URL_OK);
  });

  it("refuses a success that is not JSON", async () => {
    const fake = sender({ status: 200, text: "<html>hello</html>" });
    await expect(relayChat(options(fake.send), body())).resolves.toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it("refuses an answer over the ceiling", async () => {
    const fake = sender({ status: 200, text: "x".repeat(MAX_REPLY_CHARS + 1) });
    await expect(relayChat(options(fake.send), body())).resolves.toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it("stops at a timeout instead of trying another address", async () => {
    const fake = sender(new RelayTimeoutError());
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 },
    ];
    const result = await relayChat(options(fake.send, lookup), body());
    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(fake.seen).toHaveLength(1);
  });

  it("stops at an oversized reply instead of trying another address", async () => {
    const fake = sender(new RelayReplyTooLargeError());
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 },
    ];
    const result = await relayChat(options(fake.send, lookup), body());
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(fake.seen).toHaveLength(1);
  });

  it("tries the next public address when one connection fails", async () => {
    let attempt = 0;
    const seen: string[] = [];
    const send: RelaySend = async (target) => {
      seen.push(target.address);
      attempt += 1;
      if (attempt === 1) throw new Error("ECONNREFUSED");
      return okReply;
    };
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 },
    ];
    const result = await relayChat(options(send, lookup), body());
    expect(result).toMatchObject({ ok: true });
    expect(seen).toEqual(["93.184.216.34", "93.184.216.35"]);
  });

  it("reports unreachable when every address fails", async () => {
    const fake = sender(new Error("ECONNREFUSED"));
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 },
    ];
    const result = await relayChat(options(fake.send, lookup), body());
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(fake.seen).toHaveLength(2);
  });

  it("reports a name that cannot be found as a gateway failure", async () => {
    const fake = sender(okReply);
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(relayChat(options(fake.send, lookup), body())).resolves.toMatchObject({
      ok: false,
      status: 502,
    });
    expect(fake.seen).toHaveLength(0);
  });

  it("never uses a key the request did not carry", async () => {
    const fake = sender(okReply);
    await relayChat(options(fake.send), body());
    expect(fake.bodies[0]).not.toContain("sk-operator");
    expect(fake.seen[0].apiKey).toBe(KEY);
  });
});
