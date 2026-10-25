// WHY: The teaching editor keeps half-typed fields, while the card stores only
// finished parts. These pure conversions keep that line in one place, so the
// wizard, the preview and the save button all agree on what is valid.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the three-step teaching editor [pack: teaching-layers]

import { newId } from "@/lib/core/id";
import { validateTeachingPart, youtubeIdFrom } from "@/lib/client/layer";
import type { TeachingPart } from "@/lib/shared/types";

/** The three kinds a learner can add in the editor. */
export type TeachingRowKind = "text" | "image" | "video";

/** Where an image comes from. Built-in is kept, never chosen anew. */
export type TeachingImageSource = "builtin" | "web" | "local";

/** Where a video comes from. Only YouTube has a time range. */
export type TeachingVideoSource = "youtube" | "web" | "local";

/** One row as the editor holds it, with every field as the learner typed it. */
export interface TeachingRow {
  key: string;
  kind: TeachingRowKind;
  text: string;
  lang: string;
  imageSource: TeachingImageSource;
  imageSrc: string;
  /** The pack picture a row may go back to after a switch away. */
  imageBuiltinSrc: string;
  imageAlt: string;
  videoSource: TeachingVideoSource;
  videoSrc: string;
  start: string;
  end: string;
  search: string;
  videoAlt: string;
}

/** A fresh row of one kind, with sensible empty defaults. */
export function blankTeachingRow(kind: TeachingRowKind, key = newId()): TeachingRow {
  return {
    key,
    kind,
    text: "",
    lang: "",
    imageSource: "web",
    imageSrc: "",
    imageBuiltinSrc: "",
    imageAlt: "",
    videoSource: "youtube",
    videoSrc: "",
    start: "",
    end: "",
    search: "",
    videoAlt: "",
  };
}

/** Turn one stored part into the editable row that shows it back. */
export function teachingRowFromPart(part: TeachingPart, key = newId()): TeachingRow {
  const row = blankTeachingRow(part.type, key);
  if (part.type === "text") {
    return { ...row, text: part.text, lang: part.lang ?? "" };
  }
  if (part.type === "image") {
    return {
      ...row,
      // A pack picture stays a pack picture until the learner replaces it.
      imageSource: part.source,
      imageSrc: part.src,
      imageBuiltinSrc: part.source === "builtin" ? part.src : "",
      imageAlt: part.alt,
    };
  }
  return {
    ...row,
    videoSource: part.source,
    videoSrc: part.src,
    start: part.start === undefined ? "" : String(part.start),
    end: part.end === undefined ? "" : String(part.end),
    search: part.search ?? "",
    videoAlt: part.alt ?? "",
  };
}

/** Every stored part as one row, in display order. */
export function teachingRowsFrom(parts: readonly TeachingPart[]): TeachingRow[] {
  return parts.map((part) => teachingRowFromPart(part));
}

/** A whole number of seconds, or the reason the field cannot be one. */
function seconds(value: string): { ok: true; value: number | undefined } | { ok: false } {
  const text = value.trim();
  if (text.length === 0) return { ok: true, value: undefined };
  if (!/^\d+$/.test(text)) return { ok: false };
  return { ok: true, value: Number(text) };
}

/** Turn one row into a finished part, or name what the learner must fix. */
export function teachingPartFromRow(
  row: TeachingRow,
): { ok: true; part: TeachingPart } | { ok: false; message: string } {
  let part: TeachingPart;
  if (row.kind === "text") {
    part = {
      type: "text",
      text: row.text.trim(),
      ...(row.lang.trim().length > 0 ? { lang: row.lang.trim() } : {}),
    };
  } else if (row.kind === "image") {
    part = {
      type: "image",
      source: row.imageSource,
      src: row.imageSrc.trim(),
      alt: row.imageAlt.trim(),
    };
  } else {
    const start = seconds(row.start);
    if (!start.ok) return { ok: false, message: "The start time is a whole number of seconds." };
    const end = seconds(row.end);
    if (!end.ok) return { ok: false, message: "The end time is a whole number of seconds." };
    const raw = row.videoSrc.trim();
    part = {
      type: "video",
      source: row.videoSource,
      src: row.videoSource === "youtube" ? (youtubeIdFrom(raw) ?? raw) : raw,
      ...(start.value === undefined ? {} : { start: start.value }),
      ...(end.value === undefined ? {} : { end: end.value }),
      ...(row.search.trim().length > 0 ? { search: row.search.trim() } : {}),
      ...(row.videoAlt.trim().length > 0 ? { alt: row.videoAlt.trim() } : {}),
    };
  }
  const problem = validateTeachingPart(part);
  return problem ? { ok: false, message: problem } : { ok: true, part };
}

/**
 * Every row as a finished part in display order. One bad row refuses the whole
 * layer, so a save never quietly drops a part the learner wrote.
 */
export function teachingPartsFromRows(
  rows: readonly TeachingRow[],
): { ok: true; parts: TeachingPart[] } | { ok: false; issues: string[] } {
  const parts: TeachingPart[] = [];
  const issues: string[] = [];
  rows.forEach((row, position) => {
    const built = teachingPartFromRow(row);
    if (built.ok) parts.push(built.part);
    else issues.push(`Part ${position + 1}: ${built.message}`);
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, parts };
}
