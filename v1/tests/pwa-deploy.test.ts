// WHY: The deploy is static and the service worker is generated after Next
// writes the export. These checks pin the pieces that make the built app
// installable and keep every local URL under the same base path.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]
// 2026-10-25 opencode: parse the real ICO and PNG headers, and check that every
// built icon link resolves to a file. [pack: pwa-deploy]

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASE_PATH } from "@/lib/shared/paths";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const built = join(projectRoot, "out");
const hasBuild = existsSync(join(built, "index.html"));

function pngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function icoCount(buffer: Buffer) {
  if (buffer.length < 6) return 0;
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return 0;
  return buffer.readUInt16LE(4);
}

type IcoEntry = { width: number; height: number; bitCount: number };

// WHY: The ICO directory, not the file name, tells the browser which sizes are
// inside. Reading the real bytes catches a placeholder or a mislabelled file.
// PACK: pwa-deploy
function icoEntries(buffer: Buffer): IcoEntry[] {
  if (buffer.length < 6) return [];
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return [];
  const count = buffer.readUInt16LE(4);
  const entries: IcoEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 16;
    if (at + 16 > buffer.length) return [];
    entries.push({
      // A zero width or height byte means 256 pixels in the ICO directory.
      width: buffer[at] === 0 ? 256 : buffer[at],
      height: buffer[at + 1] === 0 ? 256 : buffer[at + 1],
      bitCount: buffer.readUInt16LE(at + 6),
    });
  }
  return entries;
}

// WHY: Next writes the resolved deploy prefix into its own asset URLs. Reading
// it back keeps the link check meaningful when a prebuilt tree is tested
// without the environment that built it.
// PACK: pwa-deploy
function builtBasePath(html: string): string {
  const assets = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1]);
  return assets.find((url) => url.includes("/_next/static/"))?.split("/_next/static/")[0] ?? "";
}

// WHY: Only icon links have to resolve to files; scripts and stylesheets have
// their own checks. The apple touch icon is an icon link too.
// PACK: pwa-deploy
function iconLinks(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\brel="(?:icon|apple-touch-icon)"/.test(tag))
    .map((tag) => tag.match(/\bhref="([^"]+)"/)?.[1] ?? "")
    .filter((href) => href.length > 0);
}

describe("PWA deploy", () => {
  // WHY: The favicon ships in the repository, so its directory must be right
  // before any build runs. The tab icon is read from these exact bytes.
  // PACK: pwa-deploy
  it("parses a real 16, 32 and 48 pixel favicon from the public folder", async () => {
    const favicon = await readFile(join(projectRoot, "public", "favicon.ico"));
    expect(favicon.readUInt16LE(0)).toBe(0); // reserved
    expect(favicon.readUInt16LE(2)).toBe(1); // 1 = icon
    expect(favicon.readUInt16LE(4)).toBe(3); // entry count
    const entries = icoEntries(favicon);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.width)).toEqual([16, 32, 48]);
    expect(entries.map((entry) => entry.height)).toEqual([16, 32, 48]);
    for (const entry of entries) {
      expect(entry.bitCount).toBe(32);
    }
  });

  // WHY: A renamed placeholder can still be called .png, so the size comes from
  // the IHDR chunk and not from the file name.
  // PACK: pwa-deploy
  it("ships the three PNG icons at their advertised sizes", async () => {
    for (const [name, size] of [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-512.png", 512],
    ] as const) {
      const buffer = await readFile(join(projectRoot, "public", "icons", name));
      expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(buffer.subarray(12, 16).toString("ascii")).toBe("IHDR");
      expect(pngSize(buffer)).toEqual({ width: size, height: size });
    }
  });

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

  it("ships a real favicon and links the SVG mark", async () => {
    if (!hasBuild) return;
    const index = await readFile(join(built, "index.html"), "utf8");
    expect(index).toContain('rel="icon"');
    expect(index).toContain("favicon.ico");
    expect(index).toContain("icon.svg");
    expect(existsSync(join(built, "icon.svg"))).toBe(true);

    const favicon = await readFile(join(built, "favicon.ico"));
    expect(icoCount(favicon)).toBeGreaterThanOrEqual(2);

    const worker = await readFile(join(built, "sw.js"), "utf8");
    const match = worker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
    const precache: string[] = JSON.parse(match?.[1] ?? "[]");
    expect(precache).toContain("./favicon.ico");
    expect(precache).toContain("./icon.svg");
  });

  // WHY: A link is only useful if its target was exported. The base path comes
  // from the app's own rule, so a root deploy and a project subpath are both
  // checked without naming one deploy.
  // PACK: pwa-deploy
  it("points every icon link at a file that exists in the build", async () => {
    if (!hasBuild) return;
    const index = await readFile(join(built, "index.html"), "utf8");
    const base = BASE_PATH || builtBasePath(index);
    const links = iconLinks(index);
    expect(links).toContain(`${base}/favicon.ico`);
    expect(links).toContain(`${base}/icon.svg`);
    for (const href of links) {
      expect(href.startsWith(`${base}/`)).toBe(true);
      // Strip the deploy prefix the way the browser does, then look for the
      // exported file under out/.
      const target = href.slice(base.length).replace(/^\/+/, "");
      expect(existsSync(join(built, target))).toBe(true);
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
