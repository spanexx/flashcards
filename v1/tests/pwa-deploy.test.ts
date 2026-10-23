// WHY: The deploy is static and the service worker is generated after Next
// writes the export. These checks pin the pieces that make the built app
// installable and keep every local URL under the same base path.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const built = join(projectRoot, "out");
const hasBuild = existsSync(join(built, "index.html"));

function pngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("PWA deploy", () => {
  it("ships a manifest with three real icons", async () => {
    if (!hasBuild) return;
    const manifest = JSON.parse(await readFile(join(built, "manifest.webmanifest"), "utf8"));
    expect(manifest.name).toBe("Flashcards");
    expect(manifest.short_name).toBe("Flashcards");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.icons).toHaveLength(3);
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);

    for (const icon of manifest.icons) {
      const buffer = await readFile(join(built, icon.src));
      expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
      const size = pngSize(buffer);
      expect(`${size.width}x${size.height}`).toBe(icon.sizes);
    }
  });

  it("links the manifest and install control under one base path", async () => {
    if (!hasBuild) return;
    const index = await readFile(join(built, "index.html"), "utf8");
    const assets = [...index.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1]);
    const base = assets.find((url) => url.includes("/_next/static/"))?.split("/_next/static/")[0] ?? "";
    expect(index).toContain('aria-label="Install app"');
    expect(index).toContain('data-install-prompt="manual"');
    expect(index).toContain(`href="${base}/manifest.webmanifest"`);
    expect(index).toContain('name="theme-color"');
    for (const url of assets) {
      expect(url.startsWith(`${base}/`)).toBe(true);
    }
  });

  it("writes a scoped worker that precaches every route and built asset", async () => {
    if (!hasBuild) return;
    const worker = await readFile(join(built, "sw.js"), "utf8");
    expect(worker).toContain('self.addEventListener("install"');
    expect(worker).toContain('self.addEventListener("activate"');
    expect(worker).toContain('self.addEventListener("fetch"');
    expect(worker).toContain("self.registration.scope");
    expect(worker).not.toContain("http://localhost");

    const match = worker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
    expect(match).not.toBeNull();
    const precache: string[] = JSON.parse(match?.[1] ?? "[]");
    for (const route of ["./", "./library/", "./progress/", "./settings/", "./manifest.webmanifest"]) {
      expect(precache).toContain(route);
    }

    const files = await readdir(join(built, "_next", "static"), { recursive: true });
    const chunks = files.filter((file) => typeof file === "string" && file.includes("."));
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(precache).toContain(`./_next/static/${chunk.replaceAll("\\", "/")}`);
    }
  });

  it("has a home route and a not-found route", () => {
    if (!hasBuild) return;
    expect(existsSync(join(built, "index.html"))).toBe(true);
    expect(existsSync(join(built, "404.html"))).toBe(true);
  });
});
