// WHY: One call to a provider, explained in plain words when it fails and
// never retried forever. These tests pin the client's manners.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callProvider,
  chatEndpoints,
  describeHttpFailure,
  extractJson,
  readReplyText,
} from "@/lib/provider/client";
import type { ProviderConfig } from "@/lib/provider/config";

const config: ProviderConfig = {
  url: "http://provider.test",
  model: "some-model",
  key: "secret",
  swappedForWsl: false,
};

const relayConfig: ProviderConfig = { ...config, relayBase: "https://relay.test" };
const asked = [{ role: "user" as const, content: "hi" }];
const relayUrl = "https://relay.test/api/relay/chat";

function reply(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as unknown as Response;
}

function failure(status: number, payload: unknown = {}): Response {
  return {
    ok: false,
    status,
    json: async () => payload,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chatEndpoints", () => {
  it("builds the common chat-completions shapes", () => {
    expect(chatEndpoints("http://x/chat/completions")).toEqual(["http://x/chat/completions"]);
    expect(chatEndpoints("http://x/v1")).toEqual(["http://x/v1/chat/completions"]);
    expect(chatEndpoints("http://x/")).toEqual([
      "http://x/chat/completions",
      "http://x/v1/chat/completions",
    ]);
  });
});

describe("describeHttpFailure", () => {
  it("says something a person can act on", () => {
    expect(describeHttpFailure(401, "u")).toContain("key");
    expect(describeHttpFailure(403, "u")).toContain("key");
    expect(describeHttpFailure(404, "http://x")).toContain("http://x");
    expect(describeHttpFailure(429, "u")).toContain("slow down");
    expect(describeHttpFailure(503, "u")).toContain("problem on its side");
    expect(describeHttpFailure(418, "u")).toContain("418");
  });
});

describe("readReplyText", () => {
  it("reads the common reply shapes", () => {
    expect(readReplyText({ choices: [{ message: { content: "hello" } }] })).toBe("hello");
    expect(readReplyText({ choices: [{ text: "legacy" }] })).toBe("legacy");
    expect(readReplyText({ choices: [] })).toBeNull();
    expect(readReplyText(null)).toBeNull();
  });
});

describe("extractJson", () => {
  it("reads JSON out of a fence or friendly prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });

  it("refuses text with no object", () => {
    expect(() => extractJson("no object here")).toThrow("JSON object");
  });

  it("refuses broken JSON", () => {
    expect(() => extractJson('{"a": }')).toThrow("could not be read");
  });
});

describe("callProvider", () => {
  it("returns the text on a good answer", async () => {
    const fetchMock = vi.fn(async () => reply({ choices: [{ message: { content: "Piję kawę." } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result).toEqual({ ok: true, text: "Piję kawę.", via: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a rejected key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failure(401)));
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("key");
      expect(result.reason).toBe("http");
    }
  });

  it("shows the service's own sentence when it explains a refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => failure(402, { error: "This subscription is not active." })),
    );
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result).toEqual({
      ok: false,
      message: "This subscription is not active.",
      reason: "http",
    });
  });

  it("tries the second endpoint only after a 404", async () => {
    const fetchMock = vi.fn(async (url: string | URL) =>
      String(url).endsWith("/v1/chat/completions")
        ? reply({ choices: [{ message: { content: "second try" } }] })
        : failure(404),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result).toEqual({ ok: true, text: "second try", via: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a real failure against a second address", async () => {
    const fetchMock = vi.fn(async () => failure(500));
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says a provider could not be reached when the network throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("could not be reached");
      expect(result.reason).toBe("unreachable");
    }
  });

  it("names CORS as the likely cause when the browser refuses the call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("could not be reached");
      expect(result.message).toContain("CORS");
      expect(result.message).toContain("this site");
      expect(result.reason).toBe("unreachable");
    }
  });

  it("says a provider took too long when the call aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }),
    );
    const result = await callProvider(config, [{ role: "user", content: "hi" }], { timeoutMs: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("too long");
      expect(result.reason).toBe("timeout");
    }
  });

  it("refuses an answer with no words", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ choices: [{ message: { content: "   " } }] })));
    const result = await callProvider(config, [{ role: "user", content: "hi" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("no words");
      expect(result.reason).toBe("empty");
    }
  });
});

describe("callProvider with a relay", () => {
  it("keeps a working provider on the direct road", async () => {
    const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(async () =>
      reply({ choices: [{ message: { content: "direct" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider(relayConfig, asked);
    expect(result).toEqual({ ok: true, text: "direct", via: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://provider.test/chat/completions");
  });

  it("does not relay a rejected key, a timeout or an empty reply", async () => {
    const rejected = vi.fn(async () => failure(401));
    vi.stubGlobal("fetch", rejected);
    await callProvider(relayConfig, asked);
    expect(rejected).toHaveBeenCalledTimes(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }),
    );
    const timedOut = await callProvider(relayConfig, asked, { timeoutMs: 5 });
    expect(timedOut).toMatchObject({ ok: false, reason: "timeout" });

    const blank = vi.fn(async () => reply({ choices: [{ message: { content: "  " } }] }));
    vi.stubGlobal("fetch", blank);
    await callProvider(relayConfig, asked);
    expect(blank).toHaveBeenCalledTimes(1);
  });

  it("relays the same call after the browser cannot reach the provider", async () => {
    const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(async (url) => {
      if (String(url) === relayUrl) {
        return reply({ choices: [{ message: { content: "relayed" } }] });
      }
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callProvider(relayConfig, asked);
    expect(result).toEqual({ ok: true, text: "relayed", via: "relay" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe(relayUrl);

    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      url: "http://provider.test/chat/completions",
      model: "some-model",
      messages: asked,
      temperature: 0.2,
    });
    expect(init.headers).toMatchObject({ authorization: "Bearer secret" });
  });

  it("prefers the relay for a remembered host", async () => {
    const fetchMock = vi.fn(async (url: string | URL) =>
      String(url) === relayUrl
        ? reply({ choices: [{ message: { content: "relayed" } }] })
        : reply({ choices: [{ message: { content: "direct" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider({ ...relayConfig, preferRelay: true }, asked);
    expect(result).toEqual({ ok: true, text: "relayed", via: "relay" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(relayUrl);
  });

  it("falls back to direct when the preferred relay cannot be reached", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url) === relayUrl) throw new TypeError("Failed to fetch");
      return reply({ choices: [{ message: { content: "direct" } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider({ ...relayConfig, preferRelay: true }, asked);
    expect(result).toEqual({ ok: true, text: "direct", via: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries direct when the relay answers 502", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url) === relayUrl) return failure(502, { error: "The provider could not be reached." });
      return reply({ choices: [{ message: { content: "direct" } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider({ ...relayConfig, preferRelay: true }, asked);
    expect(result).toEqual({ ok: true, text: "direct", via: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops at an HTTP answer from the relay", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url) === relayUrl) return failure(401);
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await callProvider(relayConfig, asked);
    expect(result).toMatchObject({ ok: false, reason: "http" });
    if (!result.ok) expect(result.message).toContain("key");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
