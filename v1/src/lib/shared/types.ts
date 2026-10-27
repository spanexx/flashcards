// WHY: The browser and the local process must agree on the shape of a card,
// an answer and a piece of evidence. This file is the single vocabulary both
// sides import, so a change to the shape cannot silently drift between them.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: a card now names its pack and its one deck; a pack
// reports its decks, and the provider key can live in the browser.
// [pack: browser-app]

/** How a deck presents help. The level belongs to the deck, never the card. */
export type StudyLevel = "beginner" | "intermediate" | "advanced";

/** One deck inside a pack. The id is stable across versions. */
export interface Deck {
  id: string;
  name: string;
  level: StudyLevel;
}

/** One outcome word. Unjudged is its own state, never a kind of wrong. */
export type Outcome = "again" | "got_it" | "nearly" | "no" | "unjudged";

/**
 * One ordered part of a teaching layer. A layer teaches the card without
 * changing either of its sides, so only text, image and video belong here.
 */
export type TeachingPart =
  | { type: "text"; text: string; lang?: string }
  | {
      type: "image";
      source: "builtin" | "web" | "local";
      src: string;
      alt: string;
    }
  | {
      type: "video";
      source: "youtube" | "web" | "local";
      src: string;
      start?: number;
      end?: number;
      search?: string;
      alt?: string;
    };

/** An ordered piece of a card side. The core lays these out, never interprets. */
export type CardPart =
  | { type: "text"; text: string; role?: "translation" | "note"; lang?: string }
  | { type: "code"; text: string; language?: string }
  | { type: "speak"; text: string; lang?: string; label?: string }
  | { type: "media"; src: string; alt?: string; mime?: string }
  | { type: "blank"; id: string; hint?: string; width?: "short" | "medium" | "long" };

/** How a card collects its answer. The pack declares one of the four surfaces. */
export type AnswerMode = "cloze" | "picks" | "type" | "hear_type";

/** One blank inside a cloze card. */
export interface BlankDef {
  id: string;
  expected: string[];
  options?: string[];
}

/** The pack-authored answering rule for one card. */
export interface AnswerDef {
  mode: AnswerMode;
  blanks?: BlankDef[];
  options?: string[];
  correct?: string[];
  expected?: string[];
  judge?: "loose" | "exact";
  caseSensitive?: boolean;
  working?: { label: string; expected: string };
}

/** Where a card came from. The note is for the learner, never a behaviour switch. */
export interface CardOrigin {
  kind: "pack" | "learner" | "generated" | "imported";
  note: string;
  packName?: string;
  packVersion?: string;
  requestId?: string;
}

/** One flat card shape across every subject. */
export interface Card {
  id: string;
  packName?: string;
  deckId?: string;
  topics: string[];
  tags: string[];
  summary: string;
  prompt: CardPart[];
  answer: CardPart[];
  answerDef: AnswerDef;
  hints?: string[];
  fullLine?: string;
  teaching?: TeachingPart[];
  origin: CardOrigin;
  retired?: boolean;
  editedFrom?: string;
  createdAt: string;
}

/** The pack author's card source, before the core gives it an identity. */
export interface CardSource {
  key?: string;
  summary: string;
  topics: string[];
  tags?: string[];
  prompt: CardPart[];
  answer: CardPart[];
  answerDef: AnswerDef;
  hints?: string[];
  fullLine?: string;
  teaching?: TeachingPart[];
}

/** One answer, appended and never edited. */
export interface EvidenceRow {
  id: string;
  cardId: string;
  attemptId: string;
  region: string | null;
  outcome: Outcome;
  timeMs: number;
  seenBefore: number;
  at: string;
  kind: "answer" | "correction";
  supersedes?: string;
  /** The teaching layer was visible before this answer. */
  helpSeen?: boolean;
  /** This answer was the unaided repeat after a peek. */
  coldCheck?: boolean;
}

/** One local image or video. The blob is the only copy the browser keeps. */
export interface MediaRecord {
  id: string;
  blob: Blob;
  mime: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  bytes: number;
  createdAt: string;
}

/** A deliberate removal that new seeds must respect. */
export interface Tombstone {
  id: string;
  kind: "pack" | "card";
  at: string;
}

/**
 * A session fact: the offer, what the learner answered, and whether they
 * stopped. The started fact may also name the scope it drew from, so a finished
 * session can be learned again. An absent pack means the row predates scopes;
 * an empty pack means the whole library.
 */
export interface SessionEvent {
  type: "started" | "ended";
  id: string;
  at: string;
  offered: number;
  answered?: number;
  completed?: boolean;
  stopped?: boolean;
  pack?: string;
  deck?: string;
}

/** One named reason group on the plan screen. */
export interface PlanGroup {
  topic: string;
  label: string;
  reason: string;
  cardIds: string[];
}

/** The plan the learner sees before any card. The reason is shown, never stored. */
export interface Plan {
  sessionId: string;
  cards: Card[];
  groups: PlanGroup[];
  offer: number;
  algorithm: "default" | "fallback";
  fallbackCount: number;
  banner: TutorBanner | null;
}

/** The per-session tutor disclosure shown before the first card. */
export interface TutorBanner {
  available: boolean;
  model: string | null;
  endpoint: string | null;
  seesCardText: boolean;
  seesOutcomeCategory: boolean;
  seesLearnerText: false;
  slots: string[];
  shape: string;
}

/** Per-region judging result returned to the browser after an answer. */
export interface RegionResult {
  region: string | null;
  outcome: Outcome;
  given: string;
  expected: string[];
  nearMiss: boolean;
}

/** The reveal payload: the answer side plus how each region was judged. */
export interface AnswerResult {
  cardId: string;
  attemptId: string;
  results: RegionResult[];
  cardOutcome: Outcome;
  capped: boolean;
  judge: "local" | "learner";
  rows: EvidenceRow[];
}

/** A progress item: a named card the learner can now handle. */
export interface ProgressCardItem {
  cardId: string;
  summary: string;
  topics: string[];
  attempts: number;
  kind: "improved" | "faster";
}

/** A named topic with a plain reason, never a score. */
export interface TopicItem {
  topic: string;
  label: string;
  cardIds: string[];
  reason: string;
}

/** The read-time progress view. Nothing here is stored. */
export interface ProgressView {
  improvements: ProgressCardItem[];
  faster: ProgressCardItem[];
  nextTopics: TopicItem[];
  strengths: TopicItem[];
  cards: Array<{
    cardId: string;
    summary: string;
    topics: string[];
    attempts: number;
    lastOutcome: Outcome | null;
    lastAt: string | null;
  }>;
}

/** One installed pack, with a plain error if it could not load. */
export interface PackStatus {
  name: string;
  version: string;
  folder: string;
  description?: string;
  language?: string;
  sourceLanguage?: string;
  studyInstruction?: string;
  prompts?: import("@/lib/packs/types").PackPrompts | null;
  decks?: Deck[];
  topics: string[];
  topicLabels: Record<string, string>;
  cardCount: number;
  error?: string;
}

/** Provider state in plain words. The key itself is never part of this. */
export interface ProviderStatus {
  configured: boolean;
  hasKey: boolean;
  endpoint: string | null;
  model: string | null;
  keyStore: "environment" | "os" | "file" | "browser" | "none";
  swappedForWsl: boolean;
  message: string;
}

/** Learner settings. Categories only; nothing here is learner-written text. */
export interface Settings {
  version: number;
  level: "beginner" | "intermediate" | "advanced";
  learningStyle: "examples-first" | "rules-first" | "conversation" | "gentle";
  provider: { url: string; model: string };
  algorithm: {
    lastAlgorithm: "default" | "fallback";
    fallbackCount: number;
    lastFallbackAt: string | null;
  };
}

/** One line in the local prompt log. */
export interface PromptLogEntry {
  at: string;
  kind: "generation" | "hint";
  requestId: string;
  endpoint: string | null;
  model: string | null;
  prompt: string;
}
