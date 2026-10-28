// WHY: A recovery link is only useful if it reaches an inbox. Brevo's HTTPS API
// needs no SDK and no SMTP client, so the service stays dependency-free; one
// verified sender address is enough, which means no domain to buy.
// PACK: subscription-recovery
// 2026-10-28 qoder: created for the one-time recovery link. [pack: subscription-recovery]

/** A mail attempt that failed. The message never holds the address or the link. */
export class MailError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "MailError";
    this.status = status;
  }
}

/** The one thing recovery needs from a mailer. */
export interface RecoveryMailer {
  sendRecoveryLink(email: string, link: string, ttlSeconds: number): Promise<void>;
}

export interface BrevoMailerOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** The whole message: one road, one link, one expiry. Nothing about the learner. */
export function recoveryMailText(
  link: string,
  ttlSeconds: number,
): { subject: string; textContent: string } {
  const minutes = Math.max(1, Math.round(ttlSeconds / 60));
  return {
    subject: "Study tutor — your subscription link",
    textContent: [
      "Open this link in the browser where you want your subscription:",
      "",
      link,
      "",
      `The link expires in ${minutes} minute${minutes === 1 ? "" : "s"}. If you did not ask for it, you can ignore this email.`,
    ].join("\n"),
  };
}

/** A Brevo sender over one API key, with a bounded wait on every call. */
export function createBrevoMailer(options: BrevoMailerOptions): RecoveryMailer {
  const apiBase = (options.apiBase ?? "https://api.brevo.com").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  return {
    async sendRecoveryLink(email, link, ttlSeconds) {
      const mail = recoveryMailText(link, ttlSeconds);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(`${apiBase}/v3/smtp/email`, {
          method: "POST",
          headers: {
            "api-key": options.apiKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { email: options.fromEmail, name: options.fromName },
            to: [{ email }],
            subject: mail.subject,
            textContent: mail.textContent,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new MailError(0, aborted ? "The mailer timed out." : "The mailer could not be reached.");
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new MailError(response.status, `The mailer answered ${response.status}.`);
    },
  };
}
