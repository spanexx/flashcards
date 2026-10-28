// WHY: One email stands between a learner and their paid pass. The provider is
// a single HTTPS call, so these tests pin the exact shape and the promise that a
// failure never repeats the address or the link.
// PACK: subscription-recovery
// 2026-10-28 qoder: created for the one-time recovery link. [pack: subscription-recovery]

import { describe, expect, it, vi } from "vitest";
import {
  createBrevoMailer,
  MailError,
  recoveryMailText,
} from "../server/src/mailer";

const LINK = "https://app.test/flashcards/settings/?recover=abc.def";

function fakeFetch(answer: Response | Error) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

function mailer(fetchImpl: typeof fetch) {
  return createBrevoMailer({
    apiKey: "xkeysib-key-value",
    fromEmail: "links@example.com",
    fromName: "Study tutor",
    fetchImpl,
  });
}

describe("recoveryMailText", () => {
  it("carries the link, the expiry in minutes and nothing about the learner", () => {
    const mail = recoveryMailText(LINK, 1800);
    expect(mail.subject).toBe("Study tutor — your subscription link");
    expect(mail.textContent).toContain(LINK);
    expect(mail.textContent).toContain("30 minutes");
    expect(mail.textContent).toContain("If you did not ask for it");
    expect(mail.textContent).not.toContain("@");
  });

  it("rounds a short window up to at least one minute", () => {
    expect(recoveryMailText(LINK, 30).textContent).toContain("1 minute.");
  });
});

describe("createBrevoMailer", () => {
  it("posts one transactional message with the api key in its header", async () => {
    const { fetchImpl, calls } = fakeFetch(new Response("{}", { status: 201 }));
    await mailer(fetchImpl).sendRecoveryLink("ana@example.com", LINK, 1800);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("xkeysib-key-value");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      sender: { email: "links@example.com", name: "Study tutor" },
      to: [{ email: "ana@example.com" }],
      subject: "Study tutor — your subscription link",
    });
    expect(String(body.textContent)).toContain(LINK);
  });

  it("refuses a non-2xx answer without repeating the address or link", async () => {
    const { fetchImpl } = fakeFetch(new Response("{}", { status: 401 }));
    const error = await mailer(fetchImpl)
      .sendRecoveryLink("ana@example.com", LINK, 1800)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MailError);
    expect((error as MailError).status).toBe(401);
    expect((error as MailError).message).not.toContain("ana@example.com");
    expect((error as MailError).message).not.toContain(LINK);
  });

  it("reports a network failure and a timeout as plain sentences", async () => {
    const down = await mailer(fakeFetch(new Error("ECONNREFUSED")).fetchImpl)
      .sendRecoveryLink("ana@example.com", LINK, 1800)
      .catch((caught: unknown) => caught);
    expect(down).toBeInstanceOf(MailError);
    expect((down as MailError).status).toBe(0);
    expect((down as MailError).message).toBe("The mailer could not be reached.");

    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    const slow = await mailer(fakeFetch(aborted).fetchImpl)
      .sendRecoveryLink("ana@example.com", LINK, 1800)
      .catch((caught: unknown) => caught);
    expect((slow as MailError).message).toBe("The mailer timed out.");
  });
});
