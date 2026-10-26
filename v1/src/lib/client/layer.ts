// WHY: Images and videos are the one part of a card that can fail while the
// learner is studying. These pure labels and addresses let the media view show
// one plain message without guessing what the browser already knows.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]
// 2026-10-26 qoder: the beginner auto-open default now answers to the learner's
// device preference; the policy itself is unchanged. [pack: study-resilience]

import type { Card, Deck, StudyLevel, TeachingPart } from "@/lib/shared/types";

/** A teaching video part; the only kind with a YouTube source. */
export type TeachingVideoPart = Extract<TeachingPart, { type: "video" }>;

/** A text part; the only kind Listen reads. */
export type TeachingTextPart = Extract<TeachingPart, { type: "text" }>;

/** The deck shape the study screen needs; the pack list already carries it. */
export type LevelDeck = Pick<Deck, "id" | "level">;

/** A pack as the study screen sees it: a name and its decks. */
export interface LevelPack {
  name: string;
  decks?: readonly LevelDeck[];
}

/**
 * Resolve a card's presentation level from its deck. A card without a deck, or
 * a pack that is not loaded, reads as the neutral intermediate.
 */
export function deckLevelFor(
  card: Pick<Card, "packName" | "deckId">,
  packs: readonly LevelPack[],
): StudyLevel {
  if (!card.packName || !card.deckId) return "intermediate";
  const pack = packs.find((entry) => entry.name === card.packName);
  const deck = pack?.decks?.find((entry) => entry.id === card.deckId);
  return deck?.level ?? "intermediate";
}

/** Where the layer sits when the card has a layer. */
export type LayerPlacement = "open" | "folded" | "hidden";

/** The whole presentation rule for one level; the study screen only reads it. */
export interface LayerPolicy {
  hasLayer: boolean;
  /** What waits before the answer. */
  before: LayerPlacement;
  /** What is available after the answer is revealed. */
  after: LayerPlacement;
  /** Opening before the answer adds one cold repeat (intermediate only). */
  peekAddsReturn: boolean;
}

/** Three levels, three behaviours. No layer means no furniture at all. */
export function layerPolicy(level: StudyLevel, hasLayer: boolean): LayerPolicy {
  if (!hasLayer) {
    return { hasLayer: false, before: "hidden", after: "hidden", peekAddsReturn: false };
  }
  if (level === "beginner") {
    return { hasLayer: true, before: "open", after: "folded", peekAddsReturn: false };
  }
  if (level === "advanced") {
    return { hasLayer: true, before: "hidden", after: "folded", peekAddsReturn: false };
  }
  return { hasLayer: true, before: "folded", after: "folded", peekAddsReturn: true };
}

/**
 * What waits before the answer, once the learner's automatic-opening choice is
 * known. Only the beginner "open" placement changes: folding it keeps the bar,
 * and every other level behaves exactly as `layerPolicy` says (GRILL Q2).
 */
export function autoOpenPolicy(policy: LayerPolicy, autoOpen: boolean): LayerPlacement {
  if (!autoOpen && policy.before === "open") return "folded";
  return policy.before;
}

/** Why a card comes back, or null when it does not. One return per card. */
export type ReturnReason = "cold" | "wrong";

/** The single return rule: a peek wins over a wrong answer, and both return once. */
export function returnReason(input: {
  level: StudyLevel;
  peeked: boolean;
  wrong: boolean;
  alreadyReturned: boolean;
}): ReturnReason | null {
  if (input.alreadyReturned) return null;
  if (input.level === "intermediate" && input.peeked) return "cold";
  return input.wrong ? "wrong" : null;
}

/** The words above the layer, keyed to what the level costs. */
export function layerExplanation(level: StudyLevel, answered: boolean): string {
  if (level === "beginner") {
    return "Open before the question. Collapse it to answer; the bar stays.";
  }
  if (level === "intermediate") {
    return answered
      ? "Opening it after the answer adds nothing."
      : "Opening this before you answer adds a repeat at the end, without the layer.";
  }
  return "Available after the answer. Opening it adds no extra card.";
}

/** The words on the folded bar, so a closed layer never looks like a lost one. */
export function layerBarText(level: StudyLevel, answered: boolean): string {
  if (level === "beginner") return "Collapsed. Reopening it adds nothing.";
  if (level === "intermediate") {
    return answered
      ? "Folded. Opening it after the answer adds nothing."
      : "Folded. Opening it before you answer adds a repeat at the end.";
  }
  return "Folded. Opening it adds no extra card.";
}

/** One line Listen will say, with the language that line needs. */
export interface SpeechLine {
  text: string;
  lang: string;
}

/**
 * The text parts in display order, one line each. Media is skipped, blank text
 * is skipped, and a part without its own language takes the pack's language.
 */
export function layerSpeech(
  parts: readonly TeachingPart[],
  defaultLang?: string,
): SpeechLine[] {
  const fallback = defaultLang?.trim() ?? "";
  return parts
    .filter((part): part is TeachingTextPart => part.type === "text")
    .map((part) => ({
      text: part.text.trim(),
      lang: part.lang?.trim() || fallback,
    }))
    .filter((line) => line.text.length > 0);
}

/** The still used to check whether a YouTube id is alive before showing a player. */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** The still size a live video always answers with. */
const YOUTUBE_STILL_WIDTH = 480;
const YOUTUBE_STILL_HEIGHT = 360;

/**
 * Whether a loaded still is YouTube's placeholder rather than a real picture. A
 * dead id returns HTTP 404 with a valid 120x90 body, so the load event fires and
 * only the size separates the two.
 */
export function youtubeStillIsDead(width: number, height: number): boolean {
  return width < YOUTUBE_STILL_WIDTH || height < YOUTUBE_STILL_HEIGHT;
}

/** The privacy-friendly player address for one video and optional section. */
export function youtubeEmbedUrl(id: string, start?: number, end?: number): string {
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (start !== undefined) params.set("start", String(start));
  if (end !== undefined) params.set("end", String(end));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** The ordinary watch address, used when the player cannot be shown. */
export function youtubeWatchUrl(id: string, start?: number): string {
  const base = `https://www.youtube.com/watch?v=${id}`;
  return start === undefined ? base : `${base}&t=${start}s`;
}

/** The words shown beside the open link when a video cannot be played. */
export function youtubeFallbackLabel(part: TeachingVideoPart): string {
  return part.search?.trim() || part.alt?.trim() || "Open on YouTube";
}

/** A YouTube video is always named by its 11-character id. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** A local source names a record in the media store, never a path. */
const LOCAL_MEDIA_ID = /^media-[A-Za-z0-9-]+$/;

/** Read the video id out of a bare id or any ordinary YouTube address. */
export function youtubeIdFrom(input: string): string | null {
  const text = input.trim();
  if (YOUTUBE_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const watched = url.searchParams.get("v") ?? "";
  if (YOUTUBE_ID.test(watched)) return watched;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
    const id = parts[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  return null;
}

/** True when a source is not an http or https address. */
function notWebAddress(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol !== "http:" && url.protocol !== "https:";
  } catch {
    return true;
  }
}

/**
 * The first problem with one teaching part, in plain words, or null. The
 * editor checks before it saves and the router checks again on the way in.
 */
export function validateTeachingPart(part: TeachingPart): string | null {
  if (part.type === "text") {
    return part.text.trim().length > 0 ? null : "A text part needs words.";
  }
  if (part.type === "image") {
    if (part.alt.trim().length === 0) return "Give the image a short description.";
    if (part.source === "local") {
      return LOCAL_MEDIA_ID.test(part.src) ? null : "Choose a local image file.";
    }
    if (part.source === "builtin") {
      return part.src.trim().length > 0 ? null : "The image needs an app path.";
    }
    return notWebAddress(part.src) ? "The image needs an http or https address." : null;
  }
  if (part.source === "local" && !LOCAL_MEDIA_ID.test(part.src)) {
    return "Choose a local video file.";
  }
  if (part.source === "web" && notWebAddress(part.src)) {
    return "The video needs an http or https address.";
  }
  if (part.source !== "youtube" && (part.start !== undefined || part.end !== undefined)) {
    return "Start and end belong to a YouTube video.";
  }
  if (part.source === "youtube") {
    if (!YOUTUBE_ID.test(part.src)) return "Use the 11-character YouTube video id.";
    if (part.start !== undefined && (!Number.isInteger(part.start) || part.start < 0)) {
      return "The start time is a whole number of seconds.";
    }
    if (part.end !== undefined && (!Number.isInteger(part.end) || part.end < 0)) {
      return "The end time is a whole number of seconds.";
    }
    if (part.start !== undefined && part.end !== undefined && part.end <= part.start) {
      return "The end time must be after the start time.";
    }
  }
  return null;
}
