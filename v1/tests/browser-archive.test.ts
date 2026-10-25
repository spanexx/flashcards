// WHY: A backup that carries local pictures and a shared pack that arrives
// with its own media are the same promise: what the learner sees now must
// still be there later. These tests pin the zip shape, the JSON fallback,
// rollback on a refused import, and the rule that an existing file is never
// overwritten or deleted by a restore.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching layer pack. [pack: teaching-layers]

import { beforeEach, describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { exportPackArchive, exportBackupZip, importPackFile, restoreBackupFile } from "@/lib/browser/archive";
import { exportBackup, importBundle, PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { getMedia, putMedia, readAllMedia } from "@/lib/browser/media";
import { readCards, readPacks, readProviderKey, writeProviderKey } from "@/lib/browser/repository";

function card(teaching: unknown[] | null = null) {
  return {
    deckId: "basics",
    summary: "Piję kawę",
    prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
    answer: [{ type: "text", text: "Piję kawę." }],
    answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
    fullLine: "Piję kawę.",
    ...(teaching ? { teaching } : {}),
  };
}

function bundle(teaching: unknown[] | null = null, name = "starter"): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name, version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [card(teaching)],
  });
}

const localLayer = [
  { type: "text", text: "Read it slowly." },
  { type: "image", source: "local", src: "media-photo", alt: "A cup" },
];

function packZip(cards: unknown[], media: Record<string, string> = {}): Blob {
  const json = JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "starter", version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards,
  });
  const files: Zippable = { "pack.json": strToU8(json) };
  for (const [id, text] of Object.entries(media)) {
    files[`media/${id}.png`] = [strToU8(text), { level: 0 }];
  }
  return new Blob([zipSync(files)], { type: "application/zip" });
}

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

describe("the full backup zip", () => {
  it("holds backup.json and the local media it points at, but no orphan or key", async () => {
    await importBundle(bundle(localLayer), { kind: "pack" });
    await putMedia(
      { id: "media-photo", blob: new Blob(["pixels"], { type: "image/png" }), mime: "image/png", kind: "image" },
      store,
    );
    await putMedia(
      { id: "media-orphan", blob: new Blob(["orphan"], { type: "image/png" }), mime: "image/png", kind: "image" },
      store,
    );
    await writeProviderKey("super-secret", store);

    const blob = await exportBackupZip();
    expect(blob.type).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(files["backup.json"]).toBeTruthy();
    expect(files["media/media-photo.png"]).toBeTruthy();
    expect(files["media/media-orphan.png"]).toBeUndefined();
    expect(strFromU8(files["media/media-photo.png"])).toBe("pixels");
    const backup = JSON.parse(strFromU8(files["backup.json"])) as Record<string, unknown>;
    expect(backup.schema).toBe("flashcards.backup/v1");
    expect(JSON.stringify(backup)).not.toContain("super-secret");
  });

  it("restores a zip with its media and keeps the key already in this browser", async () => {
    await importBundle(bundle(localLayer), { kind: "pack" });
    await putMedia(
      { id: "media-photo", blob: new Blob(["pixels"], { type: "image/png" }), mime: "image/png", kind: "image" },
      store,
    );
    const blob = await exportBackupZip();

    const fresh = new MemoryStore();
    setBrowserStore(fresh);
    await writeProviderKey("kept", fresh);

    const result = await restoreBackupFile(blob);
    expect(result.ok).toBe(true);
    expect(await readProviderKey(fresh)).toBe("kept");
    expect((await readCards(fresh))[0].teaching).toEqual(localLayer);
    const media = await getMedia("media-photo", fresh);
    expect(await media?.blob.text()).toBe("pixels");
    expect(media?.mime).toBe("image/png");
  });

  it("restores an older JSON backup whose media is simply missing", async () => {
    await importBundle(bundle(localLayer), { kind: "pack" });
    const text = await exportBackup();
    const fresh = new MemoryStore();
    setBrowserStore(fresh);

    const result = await restoreBackupFile(new Blob([text], { type: "application/json" }));
    expect(result.ok).toBe(true);
    expect(await readAllMedia(fresh)).toEqual([]);
    expect((await readCards(fresh))[0].teaching).toEqual(localLayer);
  });

  it("refuses a zip without backup.json and changes nothing", async () => {
    const files: Zippable = { "other.txt": strToU8("nothing") };
    const blob = new Blob([zipSync(files)], { type: "application/zip" });
    const result = await restoreBackupFile(blob);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("(archive)");
    expect(await readCards(store)).toEqual([]);
  });
});

describe("a shared pack archive", () => {
  it("stays JSON when the pack has no local media", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const archive = await exportPackArchive("starter");
    expect(archive.ok).toBe(true);
    if (!archive.ok) return;
    expect(archive.fileName).toMatch(/\.json$/);
    expect(archive.blob.type).toBe("application/json");
    const parsed = JSON.parse(await archive.blob.text()) as Record<string, unknown>;
    expect(parsed.schema).toBe(PACK_BUNDLE_SCHEMA);
  });

  it("becomes a zip with pack.json when the pack has local media", async () => {
    await importBundle(bundle(localLayer), { kind: "pack" });
    await putMedia(
      { id: "media-photo", blob: new Blob(["pixels"], { type: "image/png" }), mime: "image/png", kind: "image" },
      store,
    );
    const archive = await exportPackArchive("starter");
    expect(archive.ok).toBe(true);
    if (!archive.ok) return;
    expect(archive.fileName).toMatch(/\.zip$/);
    const files = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
    expect(files["pack.json"]).toBeTruthy();
    expect(strFromU8(files["media/media-photo.png"])).toBe("pixels");
    const parsed = JSON.parse(strFromU8(files["pack.json"])) as Record<string, unknown>;
    expect(parsed.evidence).toBeUndefined();
  });

  it("imports a zip, writes its media, and keeps the teaching layer", async () => {
    const blob = packZip([card(localLayer)], { "media-photo": "pixels" });
    const result = await importPackFile(blob, { kind: "pack" });
    expect(result.ok).toBe(true);
    expect((await readCards(store))[0].teaching).toEqual(localLayer);
    expect(await (await getMedia("media-photo", store))?.blob.text()).toBe("pixels");
  });

  it("rolls back newly written media when the import refuses", async () => {
    const broken = { summary: "Broken", prompt: [], answer: card().answer, answerDef: card().answerDef };
    const blob = packZip([broken], { "media-photo": "pixels" });
    const result = await importPackFile(blob, { kind: "pack" });
    expect(result.ok).toBe(false);
    expect(await getMedia("media-photo", store)).toBeNull();
    expect(await readPacks(store)).toHaveLength(0);
  });

  it("never overwrites media already on this device", async () => {
    await putMedia(
      { id: "media-photo", blob: new Blob(["older"], { type: "image/png" }), mime: "image/png", kind: "image" },
      store,
    );
    const blob = packZip([card(localLayer)], { "media-photo": "newer" });
    const result = await importPackFile(blob, { kind: "pack" });
    expect(result.ok).toBe(true);
    expect(await (await getMedia("media-photo", store))?.blob.text()).toBe("older");
  });
});
