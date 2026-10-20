// WHY: A learner setting up a provider deserves one plain sentence back, not a
// stack trace. The test sends no learner content and is not written to the log.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { callProvider } from "@/lib/provider/client";
import { getProviderConfig } from "@/lib/provider/config";
import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const config = await getProviderConfig();
    if (!config.ok) return Response.json({ ok: false, message: config.message });

    const result = await callProvider(
      config.config,
      [
        { role: "system", content: "You are a connection test. Answer with the single word OK." },
        { role: "user", content: "Say OK." },
      ],
      { timeoutMs: 20000 },
    );

    return Response.json(
      result.ok
        ? { ok: true, message: "The provider answered. It is ready to use." }
        : { ok: false, message: result.message },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The provider could not be tested.", 500);
  }
}
