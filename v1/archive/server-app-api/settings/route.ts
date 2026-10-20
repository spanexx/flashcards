// WHY: Settings shows the learner their level, their style, their folders and
// the quiet algorithm receipt. The provider key itself never passes through here.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { readSettings, updateSettings } from "@/lib/core/settings";
import { providerStatus } from "@/lib/provider/config";
import { getDataDir, getPacksDir } from "@/lib/storage/paths";
import { APP_VERSION } from "@/lib/version";
import { asRecord, jsonError, readJsonBody } from "@/lib/api/http";
import type { Settings } from "@/lib/shared/types";

export const runtime = "nodejs";

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const STYLES = new Set(["examples-first", "rules-first", "conversation", "gentle"]);

export async function GET() {
  try {
    const settings = await readSettings();
    const provider = await providerStatus();
    return Response.json({
      settings,
      provider,
      folders: { data: getDataDir(), packs: getPacksDir() },
      version: APP_VERSION,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Settings could not be read.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    if (!body) return jsonError("The change arrived in a shape the app does not understand.");

    const patch: Partial<Settings> = {};
    if (typeof body.level === "string") {
      if (!LEVELS.has(body.level)) return jsonError("That is not a level the app knows.");
      patch.level = body.level as Settings["level"];
    }
    if (typeof body.learningStyle === "string") {
      if (!STYLES.has(body.learningStyle)) return jsonError("That is not a learning style the app knows.");
      patch.learningStyle = body.learningStyle as Settings["learningStyle"];
    }
    const provider = asRecord(body.provider);
    if (provider) {
      const current = await readSettings();
      patch.provider = {
        url: typeof provider.url === "string" ? provider.url.trim() : current.provider.url,
        model: typeof provider.model === "string" ? provider.model.trim() : current.provider.model,
      };
    }

    const settings = await updateSettings(patch);
    return Response.json({ settings, provider: await providerStatus() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The change could not be saved.", 500);
  }
}
