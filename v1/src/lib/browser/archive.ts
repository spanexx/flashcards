// WHY: A backup must carry the local images and videos it points at, and a
// shared pack must arrive with its own media. This module is the one place
// that turns a library into a zip and reads one back, so export, restore and
// the pack picker agree on names, rollback and what is never overwritten.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching layer pack. [pack: teaching-layers]

import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from "fflate";
import type { MediaRecord } from "@/lib/shared/types";
import { referencedMediaIds } from "@/lib/core/media";
import {
  applyBackup,
  buildBackup,
  exportPackBundle,
  importBundle,
  parseBackup,
  restoreBackup,
  type ImportOptions,
  type ImportResult,
  type ImportTarget,
} from "@/lib/browser/bundle";
import { getMedia, putMedia, readAllMedia } from "@/lib/browser/media";
import { readCards } from "@/lib/browser/repository";
import { browserStore, type Store } from "@/lib/browser/store";
import type { ValidationIssue } from "@/lib/core/schema";

const BACKUP_ENTRY = "backup.json";
const PACK_ENTRY = "pack.json";
const MEDIA_FOLDER = "media/";

/** The media types the editor accepts, and the file name each one uses. */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
};

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSION_BY_MIME).map(([mime, extension]) => [extension, mime]),
);

const MEDIA_ID_IN_TEXT = /media-[A-Za-z0-9-]+/g;

function issue(field: string, message: string): ValidationIssue {
  return { index: 0, field, message };
}

function extensionFor(mime: string): string {
  return EXTENSION_BY_MIME[mime] ?? "bin";
}

function mediaEntryName(record: Pick<MediaRecord, "id" | "mime">): string {
  return `${MEDIA_FOLDER}${record.id}.${extensionFor(record.mime)}`;
}

/** A zip entry name becomes the media id and the MIME type it was made from. */
function mediaFromEntry(name: string, bytes: Uint8Array, at: string): MediaRecord | null {
  const file = name.slice(MEDIA_FOLDER.length);
  const dot = file.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = file.slice(0, dot);
  const mime = MIME_BY_EXTENSION[file.slice(dot + 1).toLowerCase()] ?? "application/octet-stream";
  return {
    id,
    blob: new Blob([new Uint8Array(bytes)], { type: mime }),
    mime,
    kind: mime.startsWith("video/") ? "video" : "image",
    bytes: bytes.byteLength,
    createdAt: at,
  };
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** A zip starts with PK, while a JSON backup starts with a brace or space. */
function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function zip(files: Zippable): Uint8Array {
  return zipSync(files);
}

function zipBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/zip" });
}

function unzip(bytes: Uint8Array): { ok: true; files: Unzipped } | { ok: false; issues: ValidationIssue[] } {
  try {
    return { ok: true, files: unzipSync(bytes) };
  } catch (error) {
    return {
      ok: false,
      issues: [
        issue(
          "(archive)",
          `the zip could not be opened: ${error instanceof Error ? error.message : "unknown error"}`,
        ),
      ],
    };
  }
}

/** Read the whole backup: one text file plus local media, stored as they are. */
export async function exportBackupZip(): Promise<Blob> {
  const content = await buildBackup();
  const files: Zippable = { [BACKUP_ENTRY]: strToU8(content.json) };
  for (const record of content.media) {
    files[mediaEntryName(record)] = [await bytesOf(record.blob), { level: 0 }];
  }
  return zipBlob(zip(files));
}

/** Keep media from a zip without ever replacing a file already on this device. */
async function writeMediaEntries(
  files: Unzipped,
  only: Set<string> | null,
  at: string,
  store: Store,
): Promise<string[]> {
  const written: string[] = [];
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.startsWith(MEDIA_FOLDER)) continue;
    const record = mediaFromEntry(name, bytes, at);
    if (!record || (only && !only.has(record.id))) continue;
    if (await getMedia(record.id, store)) continue;
    await putMedia(
      {
        id: record.id,
        blob: record.blob,
        mime: record.mime,
        kind: record.kind,
        width: record.width,
        height: record.height,
      },
      store,
    );
    written.push(record.id);
  }
  return written;
}

/** Restore a zip backup, or an older JSON backup whose media is absent. */
export async function restoreBackupFile(
  file: Blob,
  options: { beforeApply?: () => Promise<void> } = {},
): Promise<{ ok: true; packs: number; cards: number } | { ok: false; issues: ValidationIssue[] }> {
  const bytes = await bytesOf(file);
  if (!looksLikeZip(bytes)) return restoreBackup(strFromU8(bytes), options);

  const opened = unzip(bytes);
  if (!opened.ok) return opened;
  const json = opened.files[BACKUP_ENTRY];
  if (!json) {
    return { ok: false, issues: [issue("(archive)", "the zip has no backup.json inside it")] };
  }
  const text = strFromU8(json);
  const read = parseBackup(text);
  if (!read.ok) return read;

  const at = read.backup.exportedAt;
  const wanted = new Set(text.match(MEDIA_ID_IN_TEXT) ?? []);
  await writeMediaEntries(opened.files, wanted, at, browserStore());
  return applyBackup(read.backup, options);
}

/** One shared pack: JSON when it has no local media, a zip when it does. */
export async function exportPackArchive(
  name: string,
): Promise<{ ok: true; fileName: string; blob: Blob } | { ok: false; message: string }> {
  const exported = await exportPackBundle(name);
  if (!exported.ok) return exported;
  const stamp = new Date().toISOString().slice(0, 10);
  const cards = (await readCards()).filter((card) => card.packName === name && !card.retired);
  const wanted = referencedMediaIds(cards);
  const media = (await readAllMedia()).filter((record) => wanted.has(record.id));

  if (media.length === 0) {
    return {
      ok: true,
      fileName: `${name}-${stamp}.json`,
      blob: new Blob([exported.json], { type: "application/json" }),
    };
  }

  const files: Zippable = { [PACK_ENTRY]: strToU8(exported.json) };
  for (const record of media) {
    files[mediaEntryName(record)] = [await bytesOf(record.blob), { level: 0 }];
  }
  return { ok: true, fileName: `${name}-${stamp}.zip`, blob: zipBlob(zip(files)) };
}

/**
 * Import a shared pack from a file. Media is written first so the cards can
 * point at it; if the import refuses, only the media this call wrote is removed.
 */
export async function importPackFile(
  file: Blob,
  target: ImportTarget,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const bytes = await bytesOf(file);
  if (!looksLikeZip(bytes)) return importBundle(strFromU8(bytes), target, options);

  const opened = unzip(bytes);
  if (!opened.ok) return opened;
  const json = opened.files[PACK_ENTRY];
  if (!json) {
    return { ok: false, issues: [issue("(archive)", "the zip has no pack.json inside it")] };
  }
  const text = strFromU8(json);
  const wanted = new Set(text.match(MEDIA_ID_IN_TEXT) ?? []);
  const store = browserStore();
  const written = await writeMediaEntries(opened.files, wanted, new Date().toISOString(), store);

  const result = await importBundle(text, target, options);
  if (!result.ok) {
    for (const id of written) await store.delete("media", id);
  }
  return result;
}
