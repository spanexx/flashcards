// WHY: The app is served as plain static files, and a host may use a plain HTTP
// address where the browser hides crypto.randomUUID. IDs still have to be made
// for evidence, plans, prepared prompts and edited cards. Use the random bytes
// the browser always exposes, with a last-resort fallback for an old host.
// PACK: library-create-flow
// 2026-10-22 opencode: added an insecure-context-safe id after the Cards edit
// path failed on a static HTTP host. [pack: library-create-flow]

/** A random UUID-shaped id that also works outside a secure browser context. */
export function newId(): string {
  const source = globalThis.crypto;
  if (source && typeof source.randomUUID === "function") return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === "function") {
    source.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
