// WHY: Autosave depends on one small bell that every write rings. If a
// suspended restore ever leaked a ring, autosave could overwrite a good backup
// with a half-restored library. These tests pin the bell's whole contract.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (drift N4).

import { describe, expect, it, vi } from "vitest";
import { markChanged, onLibraryChange, resumeChanges, suspendChanges } from "@/lib/browser/changes";

describe("library change bell", () => {
  it("rings every listener and stops when the listener leaves", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stop = onLibraryChange(first);
    const stopOther = onLibraryChange(second);

    markChanged();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stop();
    markChanged();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopOther();
  });

  it("stays quiet while suspended and rings again after resume", () => {
    const listener = vi.fn();
    const stop = onLibraryChange(listener);

    suspendChanges();
    markChanged();
    expect(listener).not.toHaveBeenCalled();

    resumeChanges();
    markChanged();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("needs every suspended operation to resume before the bell rings", () => {
    const listener = vi.fn();
    const stop = onLibraryChange(listener);

    suspendChanges();
    suspendChanges();
    resumeChanges();
    markChanged();
    expect(listener).not.toHaveBeenCalled();

    resumeChanges();
    markChanged();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});
