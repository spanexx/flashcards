// WHY: The learner must see the exact prompt before it leaves, and the page
// must never build one. The server keeps a short-lived prepared request, hands
// the browser its text and its id, and sends the stored text when approved.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: the same short-lived hold now lives in the browser; no
// server-only import, global random id.
// 2026-10-22 opencode: newId keeps prepared prompts working on a static HTTP
// host. [pack: library-create-flow]
// 2026-10-22 opencode: a held request keeps the brief that prepared it, so the
// answer can be checked against the requested style. [pack: creation-control]

import { newId } from "@/lib/core/id";
import type { ChatMessage } from "@/lib/provider/client";
import type { CreationBrief } from "@/lib/shared/creation";

/** A prompt held for approval. It is one-time use and expires quickly. */
export interface PreparedRequest {
  id: string;
  kind: "generation" | "hint";
  display: string;
  messages: ChatMessage[];
  /** Older held requests did not carry a target; they behave like cards. */
  targetKind?: "pack" | "deck" | "cards";
  packName: string | null;
  topic: string | null;
  deckId?: string | null;
  count: number | null;
  cardId: string | null;
  /** The learner's brief, kept so generation can enforce the requested style. */
  brief?: CreationBrief;
  expiresAt: number;
}

/** Ten minutes is long enough to read a prompt and short enough to forget. */
const TTL_MS = 10 * 60 * 1000;

const held = new Map<string, PreparedRequest>();

/** Store a prepared prompt and return the id the browser sends back. */
export function holdPrepared(
  request: Omit<PreparedRequest, "id" | "expiresAt">,
): PreparedRequest {
  const prepared: PreparedRequest = {
    ...request,
    id: newId(),
    expiresAt: Date.now() + TTL_MS,
  };
  held.set(prepared.id, prepared);

  // Keep the little map clean without a timer.
  for (const [id, entry] of held) {
    if (entry.expiresAt <= Date.now()) held.delete(id);
  }
  return prepared;
}

/** Take a prepared prompt once. Expired or unknown ids return null. */
export function takePrepared(id: string): PreparedRequest | null {
  const prepared = held.get(id);
  if (!prepared) return null;
  held.delete(id);
  if (prepared.expiresAt <= Date.now()) return null;
  return prepared;
}

/** Forget everything. Used by tests and by a full restart of the process. */
export function clearPrepared(): void {
  held.clear();
}
