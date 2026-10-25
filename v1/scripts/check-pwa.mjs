// WHY: A static deploy can look fine in a local build and still break on Pages
// because one asset or route kept the wrong base path. This check walks the
// built tree, the manifest and the worker so CI fails before publishing.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, "..", "out");
const failures = [];
const notes = [];

function normalizeBase(raw) {
  const value = (raw ?? "").trim();
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

const basePath = normalizeBase(process.env.NEXT_PUBLIC_BASE_PATH);
const fail = (message) => failures.push(message);
const check = (condition, message) => {
  if (!condition) fail(message);
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) return walk(full);
      return [relative(output, full).split(sep).join("/")];
    }),
  );
  return files.flat();
}

function localFile(url) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean.startsWith("/")) return null;
  if (basePath) {
    if (!clean.startsWith(`${basePath}/`)) return null;
    return clean.slice(basePath.length + 1);
  }
  return clean.slice(1);
}

function fileFor(url) {
  const local = localFile(url);
  if (local === null) return null;
  if (local === "" || local.endsWith("/")) {
    const index = `${local}index.html`;
    return existsSync(join(output, index)) ? index : null;
  }
  if (existsSync(join(output, local))) return local;
  const index = `${local}/index.html`;
  return existsSync(join(output, index)) ? index : null;
}

function pngSize(buffer) {
  if (buffer.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, index) => buffer[index] === byte)) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function icoCount(buffer) {
  if (buffer.length < 6) return 0;
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return 0;
  return buffer.readUInt16LE(4);
}

try {
  await stat(join(output, "index.html"));
} catch {
  console.error("check-pwa: out/index.html is missing; run npm run build first");
  process.exit(1);
}

const files = (await walk(output)).filter((file) => !file.endsWith(".map"));
const requiredRoutes = ["index.html", "library/index.html", "progress/index.html", "settings/index.html", "404.html"];
for (const route of requiredRoutes) {
  check(files.includes(route), `missing route ${route}`);
}
for (const asset of ["favicon.ico", "icon.svg"]) {
  check(files.includes(asset), `missing browser icon ${asset}`);
}
check(files.some((file) => file.startsWith("_next/static/")), "missing _next/static assets");

try {
  const favicon = await readFile(join(output, "favicon.ico"));
  check(icoCount(favicon) >= 2, "favicon.ico must contain at least two icon sizes");
} catch {
  fail("favicon.ico could not be read");
}

const manifestPath = join(output, "manifest.webmanifest");
let manifest = null;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (problem) {
  fail(`manifest.webmanifest is not valid JSON: ${problem instanceof Error ? problem.message : problem}`);
}

if (manifest) {
  check(manifest.name === "Flashcards", "manifest name must be Flashcards");
  check(manifest.short_name === "Flashcards", "manifest short_name must be Flashcards");
  check(manifest.display === "standalone", "manifest display must be standalone");
  check(typeof manifest.start_url === "string", "manifest start_url is missing");
  check(typeof manifest.scope === "string", "manifest scope is missing");
  check(/^#[0-9a-f]{6}$/i.test(manifest.theme_color ?? ""), "manifest theme_color is invalid");
  check(/^#[0-9a-f]{6}$/i.test(manifest.background_color ?? ""), "manifest background_color is invalid");
  check(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest needs at least three icons");

  for (const icon of manifest.icons ?? []) {
    if (!icon || typeof icon.src !== "string") {
      fail("manifest has an icon without a src");
      continue;
    }
    const iconFile = join(output, icon.src);
    try {
      const buffer = await readFile(iconFile);
      const size = pngSize(buffer);
      check(size !== null, `icon ${icon.src} is not a PNG`);
      if (size) {
        check(
          `${size.width}x${size.height}` === icon.sizes,
          `icon ${icon.src} is ${size.width}x${size.height}, manifest says ${icon.sizes}`,
        );
      }
    } catch {
      fail(`manifest icon is missing: ${icon.src}`);
    }
  }
  const maskable = (manifest.icons ?? []).some((icon) => String(icon.purpose ?? "").includes("maskable"));
  check(maskable, "manifest needs a maskable icon");
}

const seedIndexPath = join(output, "packs", "index.json");
let seedIndex = null;
try {
  seedIndex = JSON.parse(await readFile(seedIndexPath, "utf8"));
} catch (problem) {
  fail(`packs/index.json is not valid JSON: ${problem instanceof Error ? problem.message : problem}`);
}

if (seedIndex) {
  check(seedIndex.schema === "flashcards.pack-index/v1", "packs/index.json has the wrong schema");
  check(Array.isArray(seedIndex.packs), "packs/index.json has no packs list");
  for (const entry of seedIndex.packs ?? []) {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      typeof entry.version !== "string" ||
      typeof entry.file !== "string" ||
      !entry.file.startsWith("/packs/") ||
      entry.file.split("/").includes("..")
    ) {
      fail("packs/index.json has an invalid entry");
      continue;
    }
    const packFile = entry.file.replace(/^\/+/, "");
    if (!files.includes(packFile)) {
      fail(`packs/index.json points at a missing file: ${entry.file}`);
      continue;
    }
    try {
      const bundle = JSON.parse(await readFile(join(output, packFile), "utf8"));
      check(bundle.schema === "flashcards.pack/v1", `${packFile} has the wrong schema`);
      check(bundle.pack?.name === entry.name, `${packFile} pack name does not match the manifest`);
      check(String(bundle.pack?.version) === entry.version, `${packFile} version does not match the manifest`);
    } catch (problem) {
      fail(`${packFile} is not valid JSON: ${problem instanceof Error ? problem.message : problem}`);
    }
  }
}

const htmlFiles = files.filter((file) => file.endsWith(".html"));
for (const file of htmlFiles) {
  const html = await readFile(join(output, file), "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (
      url.startsWith("#") ||
      url.startsWith("data:") ||
      url.startsWith("mailto:") ||
      url.startsWith("tel:") ||
      url.startsWith("javascript:") ||
      url.startsWith("http:") ||
      url.startsWith("https:") ||
      url.startsWith("//")
    ) {
      continue;
    }
    if (!url.startsWith("/")) continue;
    if (basePath && !url.startsWith(`${basePath}/`)) {
      fail(`${file} has an unprefixed root URL: ${url}`);
      continue;
    }
    if (!fileFor(url)) fail(`${file} points at a missing file: ${url}`);
  }

  const manifestLink = html.match(/<link[^>]+rel="manifest"[^>]*>/i)?.[0] ?? "";
  check(manifestLink.length > 0, `${file} has no manifest link`);
  const manifestHref = manifestLink.match(/href="([^"]+)"/)?.[1] ?? "";
  check(
    manifestHref === `${basePath}/manifest.webmanifest`,
    `${file} manifest link is ${manifestHref || "(missing)"}, expected ${basePath}/manifest.webmanifest`,
  );
}

const indexHtml = await readFile(join(output, "index.html"), "utf8");
check(indexHtml.includes('aria-label="Install app"'), "home page has no install button");
check(indexHtml.includes('name="theme-color"'), "home page has no theme-color");
check(/<link[^>]+rel="icon"[^>]+favicon\.ico/i.test(indexHtml), "home page does not link favicon.ico");
check(/<link[^>]+rel="icon"[^>]+icon\.svg/i.test(indexHtml), "home page does not link icon.svg");

const workerPath = join(output, "sw.js");
let worker = "";
try {
  worker = await readFile(workerPath, "utf8");
} catch {
  fail("sw.js is missing");
}
if (worker) {
  check(worker.includes('self.addEventListener("install"'), "sw.js has no install handler");
  check(worker.includes('self.addEventListener("activate"'), "sw.js has no activate handler");
  check(worker.includes('self.addEventListener("fetch"'), "sw.js has no fetch handler");
  check(worker.includes("self.registration.scope"), "sw.js cache names are not scoped to the app path");
  check(!worker.includes("http://localhost"), "sw.js contains a localhost URL");

  const precacheMatch = worker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  let precache = [];
  if (!precacheMatch) {
    fail("sw.js has no PRECACHE list");
  } else {
    try {
      precache = JSON.parse(precacheMatch[1]);
    } catch {
      fail("sw.js PRECACHE is not valid JSON");
    }
  }
  for (const route of ["./", "./library/", "./progress/", "./settings/", "./manifest.webmanifest"]) {
    check(precache.includes(route), `sw.js does not precache ${route}`);
  }
  for (const icon of [
    "./favicon.ico",
    "./icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png",
  ]) {
    check(precache.includes(icon), `sw.js does not precache ${icon}`);
  }
  for (const url of precache) {
    if (!url.startsWith("./")) {
      fail(`sw.js precache entry is not relative: ${url}`);
      continue;
    }
    const local = url === "./" ? "index.html" : url.slice(2);
    const target = local.endsWith("/") ? `${local}index.html` : local;
    check(files.includes(target), `sw.js precaches a missing file: ${url}`);
  }
  for (const asset of files.filter((file) => file.startsWith("_next/static/"))) {
    check(precache.includes(`./${asset}`), `sw.js does not precache built asset ${asset}`);
  }
}

if (failures.length > 0) {
  console.error("check-pwa: FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

notes.push(`base path: ${basePath || "/"}`);
notes.push(`files: ${files.length}`);
notes.push(`precache entries: ${worker.match(/const PRECACHE = (\[[\s\S]*?\]);/)?.[1].split("\n").length ?? 0}`);
console.log(`check-pwa: passed (${notes.join(", ")})`);
