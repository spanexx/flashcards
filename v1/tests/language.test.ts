// WHY: The language helper is the single place that decides what "English",
// "en-US" and a made-up code mean. If it drifts, prompts and study labels stop
// agreeing with the pack file.
// PACK: language-prompt-control
// 2026-10-24 opencode: created for the language and prompt control pack
// [pack: language-prompt-control]

import { describe, expect, it } from "vitest";
import {
  COMMON_LANGUAGES,
  languageName,
  languagePairLabel,
  normalizeLanguage,
  packLanguagePair,
  studyLanguageWords,
} from "@/lib/shared/language";

describe("normalizeLanguage", () => {
  it("turns common names, codes and region tags into one stored value", () => {
    expect(normalizeLanguage("Polish")).toBe("pl");
    expect(normalizeLanguage(" ENGLISH ")).toBe("en");
    expect(normalizeLanguage("pt_BR")).toBe("pt-br");
    expect(normalizeLanguage("es-MX")).toBe("es-mx");
  });

  it("keeps an unknown word instead of refusing the learner", () => {
    expect(normalizeLanguage("Klingon")).toBe("klingon");
    expect(normalizeLanguage("x- custom")).toBe("x- custom");
  });

  it("returns an empty value for empty or non-text input", () => {
    expect(normalizeLanguage("")).toBe("");
    expect(normalizeLanguage("   ")).toBe("");
    expect(normalizeLanguage(undefined)).toBe("");
    expect(normalizeLanguage(42)).toBe("");
  });
});

describe("languageName", () => {
  it("names known codes and keeps an unknown code readable", () => {
    expect(languageName("pl")).toBe("Polish");
    expect(languageName("en-US")).toBe("English");
    expect(languageName("Klingon")).toBe("klingon");
    expect(languageName("")).toBe("");
  });
});

describe("packLanguagePair", () => {
  it("reads a declared pair and records whether both sides are known", () => {
    expect(packLanguagePair({ language: "Polish", sourceLanguage: "English" })).toEqual({
      target: "pl",
      source: "en",
      targetName: "Polish",
      sourceName: "English",
      known: true,
      same: false,
    });
    expect(packLanguagePair({ language: "pl", sourceLanguage: "pl" }).same).toBe(true);
  });

  it("does not invent a language for an old pack", () => {
    expect(packLanguagePair({})).toEqual({
      target: "",
      source: "",
      targetName: "",
      sourceName: "",
      known: false,
      same: false,
    });
    expect(packLanguagePair(null).known).toBe(false);
  });
});

describe("studyLanguageWords", () => {
  it("uses safe words when the pack has no pair", () => {
    expect(studyLanguageWords({})).toEqual({
      targetName: "the target language",
      sourceName: "the question language",
    });
    expect(studyLanguageWords({ language: "pl" })).toEqual({
      targetName: "Polish",
      sourceName: "the question language",
    });
  });
});

describe("languagePairLabel", () => {
  it("shows the pair, or says it is not set", () => {
    expect(languagePairLabel({ language: "pl", sourceLanguage: "en" })).toBe("Polish → English");
    expect(languagePairLabel({ language: "pl" })).toBe("Polish");
    expect(languagePairLabel({})).toBe("Language not set");
  });

  it("offers a sorted common list", () => {
    const names = COMMON_LANGUAGES.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    expect(COMMON_LANGUAGES.find((entry) => entry.code === "pl")?.name).toBe("Polish");
  });
});
