// WHY: A broken pack must be named, refused before it can act, and must never
// stop the app. Every failure inside this file becomes a plain sentence on a
// pack record instead of an exception that reaches the learner.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import { packCardsSchema, packManifestSchema, packPromptsSchema } from "@/lib/core/schema";
import { hardRuleIssues } from "@/lib/core/card";
import { APP_VERSION } from "@/lib/version";
import type { PackRecord } from "@/lib/packs/types";

/** Read and parse one file, returning null when it does not exist. */
async function readOptionalJson(file: string): Promise<unknown | null> {
  try {
    const text = await readFile(file, "utf8");
    return JSON.parse(text) as unknown;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      throw new Error(`${path.basename(file)} is not valid JSON`);
    }
    throw error;
  }
}

/** A broken pack record. The folder name is all we can trust. */
function broken(folder: string, name: string, error: string): PackRecord {
  return {
    name,
    version: "unknown",
    folder,
    topics: [],
    topicLabels: {},
    cards: [],
    prompts: null,
    error,
  };
}

/**
 * Load one pack folder. Never throws: every failure becomes a named record the
 * app can show and skip.
 */
export async function readPackFolder(folder: string): Promise<PackRecord> {
  const folderName = path.basename(folder);
  try {
    const manifestRaw = await readOptionalJson(path.join(folder, "pack.json"));
    if (manifestRaw === null) return broken(folder, folderName, "this folder has no pack.json");

    const manifest = packManifestSchema.safeParse(manifestRaw);
    if (!manifest.success) {
      const first = manifest.error.issues[0];
      return broken(
        folder,
        folderName,
        `pack.json is wrong at ${first.path.join(".") || "the top"}: ${first.message}`,
      );
    }
    const data = manifest.data;

    if (semver.validRange(data.coreRange) === null) {
      return broken(folder, data.name, `the version range "${data.coreRange}" is not a valid range`);
    }
    const needsNewerApp = !semver.satisfies(APP_VERSION, data.coreRange);
    if (needsNewerApp) {
      return broken(
        folder,
        data.name,
        `this pack needs app ${data.coreRange}; this app is ${APP_VERSION}`,
      );
    }

    const base: PackRecord = {
      name: data.name,
      version: data.version,
      folder,
      description: data.description,
      language: data.language,
      sourceLanguage: data.sourceLanguage,
      studyInstruction: data.studyInstruction,
      topics: data.topics,
      topicLabels: data.topicLabels,
      cards: [],
      prompts: null,
    };

    let cardSources: PackRecord["cards"] = [];
    const cardsRaw = await readOptionalJson(path.join(folder, "cards.json"));
    if (cardsRaw !== null) {
      const cardsFile = packCardsSchema.safeParse(cardsRaw);
      if (!cardsFile.success) {
        const first = cardsFile.error.issues[0];
        return broken(
          folder,
          data.name,
          `cards.json is wrong at ${first.path.join(".") || "the top"}: ${first.message}`,
        );
      }

      const declaredTopics = new Set(data.topics);
      for (let index = 0; index < cardsFile.data.cards.length; index += 1) {
        const source = cardsFile.data.cards[index];
        const issues = hardRuleIssues(source, index);
        if (issues.length > 0) {
          const first = issues[0];
          return broken(
            folder,
            data.name,
            `card ${index + 1} is broken at ${first.field}: ${first.message}`,
          );
        }
        // A topic a card uses but the manifest never lists is almost always a
        // typo; catching it here keeps topic groups and labels honest.
        const unknownTopic = source.topics.find((topic) => !declaredTopics.has(topic));
        if (unknownTopic !== undefined) {
          return broken(
            folder,
            data.name,
            `card ${index + 1} uses the topic "${unknownTopic}", which pack.json does not list`,
          );
        }
      }
      cardSources = cardsFile.data.cards;
    }

    const promptsRaw = await readOptionalJson(path.join(folder, "prompts.json"));
    let prompts = null;
    if (promptsRaw !== null) {
      const promptsFile = packPromptsSchema.safeParse(promptsRaw);
      if (!promptsFile.success) {
        const first = promptsFile.error.issues[0];
        return broken(
          folder,
          data.name,
          `prompts.json is wrong at ${first.path.join(".") || "the top"}: ${first.message}`,
        );
      }
      prompts = promptsFile.data;
    }

    return { ...base, cards: cardSources, prompts };
  } catch (error) {
    return broken(
      folder,
      folderName,
      error instanceof Error ? error.message : "this pack could not be read",
    );
  }
}

/** Scan the one known library folder. A missing folder is an empty library. */
export async function scanPacks(packsDir: string): Promise<PackRecord[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(packsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const records: PackRecord[] = [];
  for (const entry of entries.sort()) {
    const folder = path.join(packsDir, entry);
    try {
      await access(path.join(folder, "pack.json"));
    } catch {
      // A folder without pack.json is not a pack; nothing to report.
      continue;
    }
    records.push(await readPackFolder(folder));
  }
  return records;
}
