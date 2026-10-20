// WHY: Every screen shows a refusal the same way: one plain sentence and, when
// there is one, a list of items that need fixing. This type is the handover
// between the local router and the screens.
// PACK: browser-app
// 2026-10-20 opencode: moved out of client/api.ts so the router can throw it
// without importing the screen helper.

/** An error carrying a plain sentence and any detail list. */
export class ApiError extends Error {
  detail: unknown;

  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.detail = detail;
  }
}
