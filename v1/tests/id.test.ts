// WHY: The static app can be opened over plain HTTP, where randomUUID is absent.
// newId must still make a UUID-shaped id from bytes the host does expose.
// PACK: library-create-flow
// 2026-10-22 opencode: created for the insecure-context id fallback [pack: library-create-flow]

import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "@/lib/core/id";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newId", () => {
  it("uses randomUUID when the host exposes it", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-4333-8444-555555555555" });
    expect(newId()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("builds the same id shape from random bytes on a plain HTTP host", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
        return bytes;
      },
    });
    expect(newId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("still returns a usable id when no random source is present", () => {
    vi.stubGlobal("crypto", undefined);
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
