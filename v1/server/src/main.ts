// WHY: The operator starts one process, and its first lines must say what is
// enabled and never what the secrets are. This file is the only place that
// reads the environment and opens a port; everything else is injected.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { enabledGroups, parseConfig } from "./config";
import { createSystemServer } from "./http";
import { createBrevoMailer } from "./mailer";
import type { ProxyOptions } from "./proxy";
import { RecoveryCooldown } from "./recovery";
import { createStripeClient } from "./stripe";
import { StatusCache, stripeSubscriptionLoader } from "./subscriptions";

const parsed = parseConfig(process.env);
if (!parsed.ok) {
  for (const problem of parsed.problems) {
    console.error(`[system-provider] ${problem.name} ${problem.reason}`);
  }
  process.exit(1);
}

const config = parsed.config;
const stripe = config.stripeSecretKey
  ? createStripeClient({ secretKey: config.stripeSecretKey, apiBase: config.stripeApiBase })
  : null;
const subscriptions = new StatusCache(
  stripe ? stripeSubscriptionLoader(stripe) : async () => null,
  config.subscriptionCacheMs,
);
const proxy: ProxyOptions | null =
  config.llmBaseUrl && config.llmModel && config.llmApiKey
    ? {
        baseUrl: config.llmBaseUrl,
        model: config.llmModel,
        apiKey: config.llmApiKey,
        timeoutMs: config.upstreamTimeoutMs,
      }
    : null;

const server = createSystemServer({
  config,
  stripe,
  subscriptions,
  proxy,
  // The relay holds no secret: each call carries the learner's own key, so it
  // is always available on this service.
  relay: { timeoutMs: config.upstreamTimeoutMs },
  // Recovery needs both the mail key and Stripe; config allows the group only
  // when Stripe is present, so the fallback below never hides a broken setup.
  recovery:
    config.recovery && stripe
      ? {
          stripe,
          mailer: createBrevoMailer({
            apiKey: config.recovery.brevoApiKey,
            fromEmail: config.recovery.fromEmail,
            fromName: config.recovery.fromName,
          }),
          secret: config.recovery.secret,
          appUrl: config.appUrl,
          tokenTtlSeconds: config.recovery.tokenTtlSeconds,
          licenseSecret: config.licenseSecret,
          licenseTtlSeconds: config.licenseTtlSeconds,
          cooldown: new RecoveryCooldown(config.recovery.cooldownSeconds * 1000),
          log: (line: string) => console.warn(line),
        }
      : null,
});
server.listen(config.port, "0.0.0.0", () => {
  console.info(
    `[system-provider] listening on 0.0.0.0:${config.port}; enabled: ${enabledGroups(config).join(", ")}`,
  );
});

/** Stop on a signal so a deploy does not leave a dead process holding the port. */
function stop(): void {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
