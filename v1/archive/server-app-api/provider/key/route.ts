// WHY: A key goes in and never comes back out. The app names the store that
// holds it so the learner is never guessing where their secret lives.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { KEY_STORE_NAMES, keyStore } from "@/lib/provider/keystore";
import { asRecord, asString, jsonError, readJsonBody } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = asRecord(await readJsonBody(request));
    const key = body ? asString(body.key) : null;
    if (key === null) return jsonError("A key is needed, or an empty value to clear it.");
    const kind = await keyStore.setKey(key);
    return Response.json({ keyStore: kind, name: KEY_STORE_NAMES[kind], hasKey: kind !== "none" });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The key could not be stored.", 500);
  }
}

export async function DELETE() {
  try {
    await keyStore.clearKey();
    return Response.json({ keyStore: "none", name: KEY_STORE_NAMES.none, hasKey: false });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "The key could not be cleared.", 500);
  }
}
