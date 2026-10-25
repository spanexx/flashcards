// WHY: The theme rule is small but easy to break at the edges: a missing key,
// a blocked store, or an explicit choice that must not follow the OS. Pinning
// it here keeps the switch honest without a browser.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]

import { describe, expect, it } from "vitest";
import {
  THEME_BOOT,
  THEME_KEY,
  applyTheme,
  readTheme,
  resolveTheme,
  themeLabel,
  type ThemeChoice,
} from "@/lib/client/theme";

function storageOf(value: string | null) {
  return { getItem: (key: string) => (key === THEME_KEY ? value : null) };
}

describe("theme preference", () => {
  it("follows the system when nothing is saved", () => {
    expect(readTheme(storageOf(null))).toBe("system");
  });

  it("reads an explicit choice", () => {
    expect(readTheme(storageOf("light"))).toBe("light");
    expect(readTheme(storageOf("dark"))).toBe("dark");
    expect(readTheme(storageOf("system"))).toBe("system");
  });

  it("refuses a value it did not write", () => {
    expect(readTheme(storageOf("DARK"))).toBe("system");
    expect(readTheme(storageOf("midnight"))).toBe("system");
  });

  it("survives a blocked store", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readTheme(blocked)).toBe("system");
    expect(readTheme(null)).toBe("system");
  });
});

describe("resolving the palette", () => {
  it("resolves system to the OS", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("keeps an explicit choice regardless of the OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("labels every choice in words a learner can pick", () => {
    const labels = (["system", "light", "dark"] as ThemeChoice[]).map(themeLabel);
    expect(labels).toEqual(["System", "Light", "Dark"]);
  });
});

describe("applying the palette", () => {
  it("writes the resolved palette and the native colour scheme", () => {
    const root = { dataset: {} as Record<string, string | undefined>, style: { colorScheme: "" } };
    expect(applyTheme("system", root, true)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});

describe("the pre-paint script", () => {
  it("reads the same key the switch writes", () => {
    expect(THEME_BOOT).toContain(THEME_KEY);
    expect(THEME_BOOT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOT).toContain("dataset.theme");
  });
});
