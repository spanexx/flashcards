import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// WHY: The core must be testable without a browser, a provider or a running
// server. The alias matches the application import style so tests exercise the
// same files the app imports.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
const srcRoot = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcRoot,
      // WHY: server-only guards real Next.js builds; under plain vitest it has
      // no meaning, so tests load a stub with the same effect and no framework.
      "server-only": serverOnlyStub,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // WHY: The covered surface is the logic the IMPL names: core, storage,
      // packs, provider, the browser repository/router/bundle and the record
      // reader. Route handlers and shared types are exercised by the post-impl
      // simulation and the browser walkthrough instead.
      include: [
        "src/lib/core/**/*.ts",
        "src/lib/storage/**/*.ts",
        "src/lib/packs/**/*.ts",
        "src/lib/provider/**/*.ts",
        "src/lib/browser/**/*.ts",
        "src/lib/bootstrap.ts",
        "src/lib/repository.ts",
      ],
      exclude: [
        "src/lib/**/index.ts",
        "src/lib/packs/types.ts",
        "src/lib/provider/types.ts",
        // The IndexedDB adapter is browser-only; the memory adapter behind the
        // same interface carries the domain tests, and the browser walkthrough
        // exercises this one.
        "src/lib/browser/store.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
});
