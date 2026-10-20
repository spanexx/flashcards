// WHY: The screens should not know whether their answer came from a server or
// from IndexedDB. They keep calling the same URL-shaped helpers; this file now
// hands those calls to the local router.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: routed to the browser-owned local router; the fetch
// lane is gone. [pack: browser-app]

import { ApiError } from "@/lib/client/errors";
import { localGet, localSend } from "@/lib/browser/router";

export { ApiError };

/** Ask the local router for something. */
export async function apiGet<T>(url: string): Promise<T> {
  return localGet<T>(url);
}

/** Send something to the local router. */
export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  return localSend<T>(url, method, body);
}
