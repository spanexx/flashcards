// WHY: GitHub Pages serves the app from a project subpath. The helper must
// turn every deploy spelling into one clean prefix, or the manifest, worker and
// plain links point at different places.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

import { afterEach, describe, expect, it, vi } from "vitest";

async function load(value: string) {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", value);
  vi.resetModules();
  return import("@/lib/shared/paths");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("base path helper", () => {
  it("leaves root deploys alone", async () => {
    const paths = await load("");
    expect(paths.BASE_PATH).toBe("");
    expect(paths.withBasePath("/library")).toBe("/library");
    expect(paths.withBasePath("library")).toBe("/library");
  });

  it("treats a single slash as the root", async () => {
    const paths = await load("/");
    expect(paths.BASE_PATH).toBe("");
    expect(paths.withBasePath("/")).toBe("/");
  });

  it("normalises the project subpath", async () => {
    for (const raw of ["/flashcards", "flashcards", "/flashcards/"]) {
      const paths = await load(raw);
      expect(paths.BASE_PATH).toBe("/flashcards");
      expect(paths.withBasePath("/library")).toBe("/flashcards/library");
      expect(paths.withBasePath("library")).toBe("/flashcards/library");
      expect(paths.withBasePath("/")).toBe("/flashcards/");
    }
  });
});
