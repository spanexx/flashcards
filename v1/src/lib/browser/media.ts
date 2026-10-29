// WHY: A local image or video is a Blob in this browser and nowhere else.
// These helpers keep the record shape, the object URL and cleanup in one seam,
// so a screen never invents its own media handling and an orphan cannot hide.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching layer pack. [pack: teaching-layers]

import type { MediaRecord } from "@/lib/shared/types";
import { newId } from "@/lib/core/id";
import { referencedMediaIds } from "@/lib/core/media";
import {
  IMAGE_MAX_BYTES,
  IMAGE_TOO_LARGE,
  MOBILE_VIDEO_LINK_ONLY,
  fitImage,
  imageTypeProblem,
  isTouchFirstMobile,
  mediaCapProblem,
  videoBytesProblem,
  videoTypeProblem,
} from "@/lib/core/media-rules";
import { markChanged } from "@/lib/browser/changes";
import { readCards } from "@/lib/browser/repository";
import { readPages } from "@/lib/browser/pages";
import { browserStore, type Store } from "@/lib/browser/store";

/** The refusal a corrupt or unreadable picture gets. */
const UNREADABLE_IMAGE = "That image could not be read. Choose another one.";

/** What a caller knows when it stores one local file. */
export interface MediaInput {
  id?: string;
  blob: Blob;
  mime: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
}

/** A fresh id safe for a store key and a zip file name. */
export function newMediaId(): string {
  return `media-${newId()}`;
}

/** Keep one Blob and return the record the card will point at. */
export async function putMedia(input: MediaInput, store: Store = browserStore()): Promise<MediaRecord> {
  const record: MediaRecord = {
    id: input.id ?? newMediaId(),
    blob: input.blob,
    mime: input.mime,
    kind: input.kind,
    width: input.width,
    height: input.height,
    bytes: input.blob.size,
    createdAt: new Date().toISOString(),
  };
  await store.put("media", record);
  markChanged();
  return record;
}

/** One picture decoded just long enough to draw it onto a canvas. */
interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** Decode with the fastest browser path, falling back to an image element. */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(UNREADABLE_IMAGE));
      image.src = url;
    });
    return {
      source: element,
      width: element.naturalWidth,
      height: element.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (problem) {
    URL.revokeObjectURL(url);
    throw problem;
  }
}

/** Encode a canvas once; null means this browser refused that format. */
function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/** The encodings tried in order: a PNG stays PNG, then becomes WebP. */
function encodingAttempts(type: string): Array<{ mime: string; quality?: number }> {
  if (type.toLowerCase() === "image/png") {
    return [
      { mime: "image/png" },
      { mime: "image/webp", quality: 0.9 },
      { mime: "image/webp", quality: 0.8 },
      { mime: "image/webp", quality: 0.7 },
      { mime: "image/webp", quality: 0.6 },
    ];
  }
  const mime = type.toLowerCase() === "image/webp" ? "image/webp" : "image/jpeg";
  return [0.9, 0.8, 0.7, 0.6].map((quality) => ({ mime, quality }));
}

/** Shrink one picture to the longest-edge and byte limits, or refuse plainly. */
async function resizeImage(file: File): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error(UNREADABLE_IMAGE);
  }
  try {
    const size = fitImage(decoded.width, decoded.height);
    if (size.width === 0 || size.height === 0) throw new Error(UNREADABLE_IMAGE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot resize images. Choose a smaller image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    for (const attempt of encodingAttempts(file.type)) {
      const blob = await canvasBlob(canvas, attempt.mime, attempt.quality);
      if (blob && blob.size <= IMAGE_MAX_BYTES) {
        return { blob, mime: attempt.mime, width: size.width, height: size.height };
      }
    }
    throw new Error(IMAGE_TOO_LARGE);
  } finally {
    decoded.release();
  }
}

/** Every kept byte on this device, across every pack and deck. */
export async function totalMediaBytes(store: Store = browserStore()): Promise<number> {
  const records = await readAllMedia(store);
  return records.reduce((sum, record) => sum + (record.bytes ?? record.blob.size), 0);
}

/** True when this browser runs on a phone or tablet, where video must be linked. */
export function deviceIsTouchFirstMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return isTouchFirstMobile(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/**
 * Resize and store a chosen image; the record keeps the size actually stored.
 * `replacingBytes` is what the file this one replaces already holds, so a
 * replacement is judged by the net total, not by counting both files.
 */
export async function storeImageFile(
  file: File,
  store: Store = browserStore(),
  replacingBytes = 0,
): Promise<MediaRecord> {
  const typeProblem = imageTypeProblem(file.type);
  if (typeProblem) throw new Error(typeProblem);
  const resized = await resizeImage(file);
  const capProblem = mediaCapProblem(await totalMediaBytes(store), resized.blob.size, replacingBytes);
  if (capProblem) throw new Error(capProblem);
  return putMedia(
    {
      blob: resized.blob,
      mime: resized.mime,
      kind: "image",
      width: resized.width,
      height: resized.height,
    },
    store,
  );
}

/**
 * Store a chosen video as it is, refusing one over 20 MB with plain words.
 * A touch-first mobile browser may not keep a video at all: the file path is
 * closed there, and the screen offers a link instead.
 */
export async function storeVideoFile(
  file: File,
  store: Store = browserStore(),
  replacingBytes = 0,
): Promise<MediaRecord> {
  const problem =
    (deviceIsTouchFirstMobile() ? MOBILE_VIDEO_LINK_ONLY : null) ??
    videoTypeProblem(file.type) ??
    videoBytesProblem(file.size) ??
    mediaCapProblem(await totalMediaBytes(store), file.size, replacingBytes);
  if (problem) throw new Error(problem);
  return putMedia({ blob: file, mime: file.type, kind: "video" }, store);
}

/** One local media record, or null when it is missing. */
export async function getMedia(id: string, store: Store = browserStore()): Promise<MediaRecord | null> {
  return store.get<MediaRecord>("media", id);
}

/** Every local media record on this device. */
export async function readAllMedia(store: Store = browserStore()): Promise<MediaRecord[]> {
  return store.all<MediaRecord>("media");
}

/** Remove one local media record. The caller owns any object URLs. */
export async function deleteMedia(id: string, store: Store = browserStore()): Promise<void> {
  await store.delete("media", id);
  markChanged();
}

/**
 * Remove one kept file when no card or page points at it any more. Replacing
 * or removing a file frees its room at once instead of waiting for a sweep.
 */
export async function deleteMediaIfUnreferenced(id: string, store: Store = browserStore()): Promise<boolean> {
  const [cards, pages] = await Promise.all([readCards(store), readPages(undefined, store)]);
  if (referencedMediaIds(cards, pages).has(id)) return false;
  await deleteMedia(id, store);
  return true;
}

/** Remove local media nothing points at: cards, retired cards and pages all count. */
export async function deleteUnreferenced(store: Store = browserStore()): Promise<string[]> {
  const [cards, pages, media] = await Promise.all([readCards(store), readPages(undefined, store), readAllMedia(store)]);
  const referenced = referencedMediaIds(cards, pages);
  const orphans = media.filter((record) => !referenced.has(record.id));
  for (const record of orphans) await store.delete("media", record.id);
  if (orphans.length > 0) markChanged();
  return orphans.map((record) => record.id);
}

/** A temporary address for one Blob. The caller must revoke it on close. */
export function mediaUrl(record: MediaRecord): string {
  return URL.createObjectURL(record.blob);
}
