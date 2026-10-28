// WHY: The proxy is the one place the operator's model key is used. It must
// forward only the three named fields, replace the model, and turn every
// upstream failure into a class the browser can show without a key inside.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { describe, expect, it, vi } from "vitest";
import {
  MAX_MESSAGE_CHARS,
  proxyChat,
  readChatRequest,
  upstreamChatUrl,
  type ProxyOptions,
} from "../server/src/proxy";

function reply(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function options(fetchImpl: typeof fetch): ProxyOptions {
  return {
    baseUrl: "https://llm.test",
    model: "operator-model",
    apiKey: "sk-operator-secret",
    timeoutMs: 20_000,
    fetchImpl,
  };
}

const request = {
  model: "whatever-the-browser-says",
  messages: [{ role: "user", content: "Say OK." }],
  temperature: 0.2,
  stream: true,
  tools: [{ type: "function" }],
};

describe("upstreamChatUrl", () => {
  it("adds the one missing piece and never doubles it", () => {
    expect(upstreamChatUrl("https://llm.test")).toBe("https://llm.test/v1/chat/completions");
    expect(upstreamChatUrl("https://llm.test/")).toBe("https://llm.test/v1/chat/completions");
    expect(upstreamChatUrl("https://llm.test/v1")).toBe("https://llm.test/v1/chat/completions");
    expect(upstreamChatUrl("https://llm.test/v1/chat/completions")).toBe(
      "https://llm.test/v1/chat/completions",
    );
  });
});

describe("readChatRequest", () => {
  it("keeps only role, text and a bounded temperature", () => {
    const read = readChatRequest(request);
    expect(read).toEqual({
      ok: true,
      request: { messages: [{ role: "user", content: "Say OK." }], temperature: 0.2 },
    });
  });

  it("refuses an empty or malformed message list", () => {
    expect(readChatRequest(null)).toMatchObject({ ok: false });
    expect(readChatRequest({})).toMatchObject({ ok: false });
    expect(readChatRequest({ messages: [] })).toMatchObject({ ok: false });
    expect(readChatRequest({ messages: [{ role: "tool", content: "x" }] })).toMatchObject({ ok: false });
    expect(readChatRequest({ messages: [{ role: "user", content: 3 }] })).toMatchObject({ ok: false });
    expect(readChatRequest({ messages: "hello" })).toMatchObject({ ok: false });
  });

  it("refuses more than forty messages or a request over the character cap", () => {
    const many = Array.from({ length: 41 }, () => ({ role: "user", content: "x" }));
    expect(readChatRequest({ messages: many })).toMatchObject({ ok: false });
    const huge = [{ role: "user", content: "x".repeat(MAX_MESSAGE_CHARS + 1) }];
    expect(readChatRequest({ messages: huge })).toMatchObject({ ok: false });
  });

  it("refuses a temperature outside zero to two", () => {
    expect(readChatRequest({ messages: request.messages, temperature: -1 })).toMatchObject({ ok: false });
    expect(readChatRequest({ messages: request.messages, temperature: 3 })).toMatchObject({ ok: false });
    expect(readChatRequest({ messages: request.messages, temperature: "warm" })).toMatchObject({ ok: false });
  });
});

describe("proxyChat", () => {
  it("forwards only the named fields, replaces the model and returns the reply", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return reply({ choices: [{ message: { content: "OK" } }] });
    }) as unknown as typeof fetch;

    const result = await proxyChat(options(fetchImpl), request);
    expect(result).toEqual({ ok: true, payload: { choices: [{ message: { content: "OK" } }] } });
    expect(calls[0].url).toBe("https://llm.test/v1/chat/completions");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(
      "Bearer sk-operator-secret",
    );
    const sent = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(sent).toEqual({
      model: "operator-model",
      messages: [{ role: "user", content: "Say OK." }],
      temperature: 0.2,
    });
  });

  it("reports an upstream rejection without its body or key", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({ error: { message: "bad key sk-operator-secret" } }, 401),
    ) as unknown as typeof fetch;
    const result = await proxyChat(options(fetchImpl), request);
    expect(result).toMatchObject({ ok: false, status: 502 });
    if (result.ok) return;
    expect(result.message).not.toContain("sk-operator-secret");
    expect(result.message).not.toContain("bad key");
  });

  it("passes a busy upstream through as 429 and a slow one as 504", async () => {
    const busy = vi.fn(async () => reply({ error: "slow down" }, 429)) as unknown as typeof fetch;
    expect(await proxyChat(options(busy), request)).toMatchObject({ ok: false, status: 429 });

    const slow = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as unknown as typeof fetch;
    expect(await proxyChat(options(slow), request)).toMatchObject({ ok: false, status: 504 });
  });

  it("treats an unreachable, wordless or oversized upstream as a bad gateway", async () => {
    const unreachable = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await proxyChat(options(unreachable), request)).toMatchObject({ ok: false, status: 502 });

    const html = vi.fn(async () => new Response("<html>nope</html>", { status: 200 })) as unknown as typeof fetch;
    expect(await proxyChat(options(html), request)).toMatchObject({ ok: false, status: 502 });

    const large = vi.fn(async () => reply("x".repeat(2_100_000))) as unknown as typeof fetch;
    expect(await proxyChat(options(large), request)).toMatchObject({ ok: false, status: 502 });
  });

  it("refuses an invalid request before any upstream call", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await proxyChat(options(fetchImpl), { messages: [] })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
