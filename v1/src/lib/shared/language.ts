// WHY: A pack must say which language it teaches and which language asks the
// question. One normaliser keeps file values, prompt words and study labels from
// disagreeing about what "English" or "en" means.
// PACK: language-prompt-control
// 2026-10-23 opencode: created for the language and prompt control pack
// [pack: language-prompt-control]

/** The readable names the app knows, keyed by a base language code. */
const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hi: "Hindi",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  zh: "Chinese",
};

/** Common names and short forms a learner may type. */
const LANGUAGE_ALIASES: Record<string, string> = {
  arabic: "ar",
  chinese: "zh",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  english: "en",
  finnish: "fi",
  french: "fr",
  german: "de",
  greek: "el",
  hebrew: "he",
  hindi: "hi",
  hungarian: "hu",
  indonesian: "id",
  italian: "it",
  japanese: "ja",
  korean: "ko",
  norwegian: "no",
  polish: "pl",
  portuguese: "pt",
  romanian: "ro",
  russian: "ru",
  slovak: "sk",
  spanish: "es",
  swedish: "sv",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
  vietnamese: "vi",
};

/** The choices the editor offers without closing the door on another code. */
export const COMMON_LANGUAGES: ReadonlyArray<{ code: string; name: string }> = Object.entries(
  LANGUAGE_NAMES,
)
  .map(([code, name]) => ({ code, name }))
  .sort((left, right) => left.name.localeCompare(right.name));

/** Turn a name or code into the stable value the app stores. */
export function normalizeLanguage(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  const lower = trimmed.toLowerCase().replace(/[._]/g, "-");
  const alias = LANGUAGE_ALIASES[lower];
  if (alias) return alias;
  // A region tag such as en-US stays one value; its base still has a name.
  if (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(lower)) return lower;
  // Unknown words are kept, not refused: the learner may know a language the
  // app has not listed yet.
  return lower;
}

/** The readable label for a stored code, or the stored value when unknown. */
export function languageName(value: string | undefined | null): string {
  const code = normalizeLanguage(value);
  if (code.length === 0) return "";
  const base = code.split("-")[0];
  return LANGUAGE_NAMES[base] ?? code;
}

/** The two languages a pack uses, with safe words for a card instruction. */
export interface PackLanguagePair {
  target: string;
  source: string;
  targetName: string;
  sourceName: string;
  known: boolean;
  same: boolean;
}

/** Read a pack's pair without inventing a language it did not declare. */
export function packLanguagePair(
  pack: { language?: string; sourceLanguage?: string } | null | undefined,
): PackLanguagePair {
  const target = normalizeLanguage(pack?.language);
  const source = normalizeLanguage(pack?.sourceLanguage);
  return {
    target,
    source,
    targetName: languageName(target),
    sourceName: languageName(source),
    known: target.length > 0 && source.length > 0,
    same: target.length > 0 && target === source,
  };
}

/** The words a card instruction can use even when a pack has not set a pair. */
export function studyLanguageWords(
  pack: { language?: string; sourceLanguage?: string } | null | undefined,
): { targetName: string; sourceName: string } {
  const pair = packLanguagePair(pack);
  return {
    targetName: pair.targetName || "the target language",
    sourceName: pair.sourceName || "the question language",
  };
}

/** A short row label such as "Polish → English", or a neutral fallback. */
export function languagePairLabel(
  pack: { language?: string; sourceLanguage?: string } | null | undefined,
): string {
  const pair = packLanguagePair(pack);
  if (pair.target.length === 0) return "Language not set";
  if (pair.source.length === 0) return pair.targetName;
  return `${pair.targetName} → ${pair.sourceName}`;
}
