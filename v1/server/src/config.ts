// WHY: The operator's secrets live in this process and nowhere else. This
// module turns the environment into one typed object, names every missing or
// unusable variable together, and never repeats a value in a failure.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

/** Everything the service needs, after validation. */
export interface ServerConfig {
  port: number;
  appUrl: string;
  appOrigin: string;
  providerName: string;
  priceLabel: string;
  stripeSecretKey: string | null;
  stripePriceId: string | null;
  stripeWebhookSecret: string | null;
  stripeApiBase: string;
  licenseSecret: string;
  licenseTtlSeconds: number;
  llmBaseUrl: string | null;
  llmModel: string | null;
  llmApiKey: string | null;
  upstreamTimeoutMs: number;
  rateLimitPerHour: number;
  subscriptionCacheMs: number;
}

/** A name that needs the operator's attention, with a reason that holds no value. */
export interface ConfigProblem {
  name: string;
  reason: string;
}

export type ConfigResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; problems: ConfigProblem[] };

const DAY = 24 * 60 * 60;

/** Read a trimmed string, treating an empty variable as absent. */
function text(env: Record<string, string | undefined>, name: string): string {
  return (env[name] ?? "").trim();
}

/** Read a whole number with a floor, a ceiling and a plain reason when wrong. */
function integer(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  min: number,
  max: number,
  problems: ConfigProblem[],
): number {
  const raw = text(env, name);
  if (raw.length === 0) return fallback;
  if (!/^\d+$/.test(raw)) {
    problems.push({ name, reason: "must be a whole number" });
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    problems.push({ name, reason: `must be between ${min} and ${max}` });
    return fallback;
  }
  return value;
}

/** Read an absolute http(s) address without a trailing slash, or record why not. */
function address(
  env: Record<string, string | undefined>,
  name: string,
  problems: ConfigProblem[],
): string | null {
  const raw = text(env, name);
  if (raw.length === 0) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      problems.push({ name, reason: "must start with http:// or https://" });
      return null;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    problems.push({ name, reason: "must be a full http(s) address" });
    return null;
  }
}

/**
 * Turn the environment into config. Optional groups (Stripe checkout, the model
 * proxy) are either complete or absent; a half-set group is a problem, because
 * a feature that looks enabled but cannot work is worse than one that is off.
 */
export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const problems: ConfigProblem[] = [];

  const rawAppUrl = text(env, "APP_URL");
  let appUrl = "";
  let appOrigin = "";
  if (rawAppUrl.length === 0) {
    problems.push({ name: "APP_URL", reason: "is required" });
  } else {
    try {
      const parsed = new URL(rawAppUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        problems.push({ name: "APP_URL", reason: "must start with http:// or https://" });
      } else {
        parsed.search = "";
        parsed.hash = "";
        if (!parsed.pathname.endsWith("/")) parsed.pathname = `${parsed.pathname}/`;
        appUrl = parsed.toString();
        appOrigin = parsed.origin;
      }
    } catch {
      problems.push({ name: "APP_URL", reason: "must be a full http(s) address" });
    }
  }

  const providerName = text(env, "SYSTEM_PROVIDER_NAME");
  if (providerName.length === 0) problems.push({ name: "SYSTEM_PROVIDER_NAME", reason: "is required" });
  const priceLabel = text(env, "SYSTEM_PRICE_LABEL");
  if (priceLabel.length === 0) problems.push({ name: "SYSTEM_PRICE_LABEL", reason: "is required" });

  const licenseSecret = text(env, "LICENSE_SECRET");
  if (licenseSecret.length < 32) {
    problems.push({ name: "LICENSE_SECRET", reason: "must be at least 32 characters" });
  }

  const stripeSecretKey = text(env, "STRIPE_SECRET_KEY");
  const stripePriceId = text(env, "STRIPE_PRICE_ID");
  if (stripeSecretKey.length > 0 && stripePriceId.length === 0) {
    problems.push({ name: "STRIPE_PRICE_ID", reason: "is required when STRIPE_SECRET_KEY is set" });
  }
  if (stripePriceId.length > 0 && stripeSecretKey.length === 0) {
    problems.push({ name: "STRIPE_SECRET_KEY", reason: "is required when STRIPE_PRICE_ID is set" });
  }

  const llmBaseUrl = address(env, "SYSTEM_LLM_BASE_URL", problems);
  const llmModel = text(env, "SYSTEM_LLM_MODEL");
  const llmApiKey = text(env, "SYSTEM_LLM_API_KEY");
  const llmGiven = [llmBaseUrl, llmModel, llmApiKey].filter((value) => (value ?? "").length > 0).length;
  if (llmGiven > 0 && llmGiven < 3) {
    if (!llmBaseUrl) problems.push({ name: "SYSTEM_LLM_BASE_URL", reason: "is required for the model proxy" });
    if (llmModel.length === 0) problems.push({ name: "SYSTEM_LLM_MODEL", reason: "is required for the model proxy" });
    if (llmApiKey.length === 0) problems.push({ name: "SYSTEM_LLM_API_KEY", reason: "is required for the model proxy" });
  }

  const stripeApiBase = address(env, "STRIPE_API_BASE", problems) ?? "https://api.stripe.com";
  const port = integer(env, "PORT", 8787, 1, 65535, problems);
  const licenseTtlSeconds = integer(env, "LICENSE_TTL_SECONDS", 30 * DAY, 60, 10 * 365 * DAY, problems);
  const upstreamTimeoutMs = integer(env, "UPSTREAM_TIMEOUT_MS", 60_000, 1_000, 10 * 60_000, problems);
  const rateLimitPerHour = integer(env, "RATE_LIMIT_PER_HOUR", 120, 1, 100_000, problems);
  const subscriptionCacheMs = integer(env, "SUBSCRIPTION_CACHE_MS", 120_000, 0, 60 * 60_000, problems);

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    config: {
      port,
      appUrl,
      appOrigin,
      providerName,
      priceLabel,
      stripeSecretKey: stripeSecretKey || null,
      stripePriceId: stripePriceId || null,
      stripeWebhookSecret: text(env, "STRIPE_WEBHOOK_SECRET") || null,
      stripeApiBase,
      licenseSecret,
      licenseTtlSeconds,
      llmBaseUrl,
      llmModel: llmModel || null,
      llmApiKey: llmApiKey || null,
      upstreamTimeoutMs,
      rateLimitPerHour,
      subscriptionCacheMs,
    },
  };
}

/** The public shape a browser may see. No value here is a secret. */
export function publicConfig(config: ServerConfig): {
  name: string;
  priceLabel: string;
  checkout: boolean;
  proxy: boolean;
} {
  return {
    name: config.providerName,
    priceLabel: config.priceLabel,
    checkout: Boolean(config.stripeSecretKey && config.stripePriceId),
    proxy: Boolean(config.llmBaseUrl && config.llmModel && config.llmApiKey),
  };
}

/** The names of enabled groups, for a startup line that holds no values. */
export function enabledGroups(config: ServerConfig): string[] {
  const groups: string[] = ["entitlement"];
  if (config.stripeSecretKey && config.stripePriceId) groups.push("checkout", "portal");
  if (config.stripeWebhookSecret) groups.push("webhook");
  if (config.llmBaseUrl && config.llmModel && config.llmApiKey) groups.push("proxy");
  return groups;
}
