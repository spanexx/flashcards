// WHY: Local media lives only in this browser, so the seam that keeps it must
// round-trip a Blob and must never delete a file a retired card still shows.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching layer pack. [pack: teaching-layers]

import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import {
  deleteUnreferenced,
  getMedia,
  putMedia,
  readAllMedia,
  storeImageFile,
  storeVideoFile,
} from "@/lib/browser/media";
import { VIDEO_MAX_BYTES } from "@/lib/core/media-rules";
import { mediaIdsInCard, referencedMediaIds } from "@/lib/core/media";
import { upsertCards } from "@/lib/browser/repository";
import { makeCard } from "./helpers";

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

function png(text = "pixels"): Blob {
  return new Blob([text], { type: "image/png" });
}

describe("the media seam", () => {
  it("stores and reads a Blob with its size and kind", async () => {
    const record = await putMedia({ blob: png(), mime: "image/png", kind: "image" }, store);
    expect(record.id).toMatch(/^media-/);
    const found = await getMedia(record.id, store);
    expect(found?.bytes).toBe(record.bytes);
    expect(found?.mime).toBe("image/png");
    expect(await found?.blob.text()).toBe("pixels");
    expect(await readAllMedia(store)).toHaveLength(1);
  });

  it("refuses a picture that is not JPEG, PNG or WebP before reading it", async () => {
    const file = new File([png()], "photo.gif", { type: "image/gif" });
    await expect(storeImageFile(file, store)).rejects.toThrow("Choose a JPEG, PNG or WebP image.");
  });

  it("stores a video within the cap and refuses one over it", async () => {
    const small = new File([new Uint8Array(16)], "clip.mp4", { type: "video/mp4" });
    const record = await storeVideoFile(small, store);
    expect(record.kind).toBe("video");
    expect(record.bytes).toBe(16);

    const big = new File([new Uint8Array(VIDEO_MAX_BYTES + 1)], "big.mp4", { type: "video/mp4" });
    await expect(storeVideoFile(big, store)).rejects.toThrow("larger than 20 MB");
  });
});

describe("media references", () => {
  it("collects local ids from the layer and from a side part", () => {
    const card = {
      prompt: [{ type: "media" as const, src: "media-side" }],
      answer: [{ type: "text" as const, text: "Back" }],
      teaching: [
        { type: "image" as const, source: "local" as const, src: "media-layer", alt: "A cup" },
        { type: "image" as const, source: "web" as const, src: "https://example.com/a.png", alt: "A cup" },
      ],
    };
    expect(mediaIdsInCard(card)).toEqual(["media-layer", "media-side"]);
  });

  it("deletes only media no card points at, retired cards included", async () => {
    await putMedia({ id: "media-live", blob: png(), mime: "image/png", kind: "image" }, store);
    await putMedia({ id: "media-retired", blob: png(), mime: "image/png", kind: "image" }, store);
    await putMedia({ id: "media-side", blob: png(), mime: "image/png", kind: "image" }, store);
    await putMedia({ id: "media-orphan", blob: png(), mime: "image/png", kind: "image" }, store);

    const live = makeCard("card:live", {
      teaching: [{ type: "image", source: "local", src: "media-live", alt: "A cup" }],
    });
    const retired = makeCard("card:retired", {
      teaching: [{ type: "image", source: "local", src: "media-retired", alt: "A cup" }],
    });
    const side = makeCard("card:side", {
      prompt: [{ type: "media", src: "media-side" }],
    });

    expect(referencedMediaIds([live, { ...retired, retired: true }, side])).toEqual(
      new Set(["media-live", "media-retired", "media-side"]),
    );
    await upsertCards([live, { ...retired, retired: true }, side], store);
    expect(await deleteUnreferenced(store)).toEqual(["media-orphan"]);
    expect((await readAllMedia(store)).map((record) => record.id).sort()).toEqual([
      "media-live",
      "media-retired",
      "media-side",
    ]);
  });
});
