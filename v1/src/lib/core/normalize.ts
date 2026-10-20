// WHY: A local judge is only fair if it ignores harmless differences and keeps
// meaningful ones. This module holds that rule in one place so the judge and
// its tests cannot disagree about what counts as the same answer.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

/** Punctuation stripped from the edges of a loose answer. */
const EDGE_PUNCTUATION = /^[\s.,!?;:¡¿"“”„'’()[\]{}-]+|[\s.,!?;:¡¿"“”„'’()[\]{}-]+$/g;

/** Stroked or ligature letters that NFD cannot split into base plus mark. */
const STROKED: Record<string, string> = {
  ł: "l",
  Ł: "l",
  ø: "o",
  Ø: "o",
  đ: "d",
  Đ: "d",
  ß: "ss",
  æ: "ae",
  Æ: "ae",
  œ: "oe",
  Œ: "oe",
};

/** Fold accents the neutral way: split marks off, map strokes by hand. */
function foldDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[łŁøØđĐßæÆœŒ]/g, (letter) => STROKED[letter] ?? letter);
}

export interface NormalizeOptions {
  caseSensitive?: boolean;
  exact?: boolean;
}

/**
 * Put an answer in the form a comparison can use.
 * Loose style folds case, edge punctuation, whitespace and diacritics: a
 * keyboard without ą, ę or ł must not fail a learner for a missing accent,
 * and the reveal still shows the correct spelling to learn. The folding is
 * neutral - it comes from Unicode, not from Polish. Exact style only trims,
 * so a code card is compared as written.
 */
export function normalizeAnswer(raw: string, options: NormalizeOptions = {}): string {
  const text = raw.normalize("NFC");
  if (options.exact) return text.trim();
  const folded = foldDiacritics(text);
  const lower = options.caseSensitive ? folded : folded.toLowerCase();
  return lower.replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ").trim();
}

/** True when the given answer matches one of the expected answers. */
export function matchesAny(
  given: string,
  expected: string[],
  options: NormalizeOptions = {},
): boolean {
  const needle = normalizeAnswer(given, options);
  if (needle.length === 0) return false;
  return expected.some((candidate) => normalizeAnswer(candidate, options) === needle);
}

/**
 * A small edit distance: one mistake for short answers, two for longer ones.
 * This is what turns a slip into Nearly rather than wrong.
 */
export function editDistance(left: string, right: string): number {
  const a = aFrom(left);
  const b = aFrom(right);
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

/** Smallest edit distance between the given answer and any expected answer. */
export function nearestDistance(
  given: string,
  expected: string[],
  options: NormalizeOptions = {},
): number {
  const needle = normalizeAnswer(given, options);
  if (needle.length === 0 || expected.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...expected.map((candidate) => editDistance(needle, normalizeAnswer(candidate, options))),
  );
}

/** True when the answer is close enough to call Nearly. Exact judges skip it. */
export function isNearMatch(
  given: string,
  expected: string[],
  options: NormalizeOptions = {},
): boolean {
  if (options.exact) return false;
  const needle = normalizeAnswer(given, options);
  if (needle.length === 0) return false;
  const allowed = needle.length <= 4 ? 1 : 2;
  return nearestDistance(given, expected, options) <= allowed;
}

/** Split a string into code points so edit distance counts letters, not bytes. */
function aFrom(text: string): string[] {
  return Array.from(text);
}
