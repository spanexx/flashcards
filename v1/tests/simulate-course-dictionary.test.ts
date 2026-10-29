// WHY: This is the post-implementation rehearsal for the course dictionary. It
// walks the PRD's eleven scenarios through the real router and the memory store,
// then checks the shipped screen for the words and layout hooks the scenarios
// name. It refuses to pretend the UI was checked when no build exists.
// PACK: course-dictionary
// 2026-10-29 qoder: created after the implementation [pack: course-dictionary]

import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { readPage, readTrace, writeShippedPage } from "@/lib/browser/pages";
import { deleteMediaIfUnreferenced, deleteUnreferenced, getMedia, putMedia } from "@/lib/browser/media";
import { writeMeta } from "@/lib/browser/repository";
import { exportPackArchive } from "@/lib/browser/archive";
import {
  cardPageId,
  deckPageId,
  packPageId,
  pageIsRead,
  PICTURE_SECONDS,
  tracedTextMs,
  VIDEO_TRACED_SHARE,
} from "@/lib/core/pages";
import {
  backupSizeWarning,
  fitImage,
  isTouchFirstMobile,
  mediaCapProblem,
  MOBILE_VIDEO_LINK_ONLY,
  TOTAL_MEDIA_MAX_BYTES,
  videoBytesProblem,
  VIDEO_TOO_LARGE,
} from "@/lib/core/media-rules";
import type { Card, DictionaryPage, PackStatus, PageTrace, TeachingPart } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const hasBuild = existsSync(join(projectRoot, "out", "index.html"));

function source(...parts: string[]): string {
  return readFileSync(join(projectRoot, "src", ...parts), "utf8");
}

async function readTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) return readTree(full);
      if (!/\.(js|html|css)$/.test(entry.name)) return "";
      return readFile(join(directory, entry.name), "utf8");
    }),
  );
  return parts.join("\n");
}

let built: Promise<string> | null = null;

function builtSources(): Promise<string> {
  if (!built) built = readTree(join(projectRoot, "out"));
  return built;
}

/** Print the line the simulation contract asks for, then assert it. */
function scenario(number: number, label: string, pass: boolean, detail = ""): void {
  console.log(`SCENARIO ${number} ${label} -> ${pass ? "PASS" : "FAIL"}`);
  if (detail) console.log(`  ${detail}`);
  expect(pass, detail || label).toBe(true);
}

const CARD_PARTS: TeachingPart[] = [
  { type: "text", text: "Coffee is a daily ritual in Poland, and it is never rushed." },
  { type: "image", source: "web", src: "https://example.test/coffee.png", alt: "A cup of coffee" },
  { type: "video", source: "youtube", src: "dQw4w9WgXcQ" },
];

function courseBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: {
      name: "polish",
      version: "1.0.0",
      description: "Polish from English.",
      language: "pl",
      sourceLanguage: "en",
    },
    decks: [
      { id: "basics", name: "Basics" },
      { id: "verbs", name: "Verbs" },
    ],
    cards: [
      {
        deckId: "basics",
        summary: "Coffee",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
        hints: ["A drink."],
        fullLine: "Piję kawę.",
      },
      {
        deckId: "basics",
        summary: "Water",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję wodę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["wodę"] }] },
        hints: ["A drink."],
        fullLine: "Piję wodę.",
      },
      {
        deckId: "verbs",
        summary: "I drink",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "I drink." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["piję"] }] },
        hints: ["A verb."],
        fullLine: "Piję.",
      },
    ],
  });
}

async function importedCourse(): Promise<{ cards: Card[]; pack: PackStatus }> {
  const imported = await localSend<{ ok: boolean }>("/api/packs/import", "POST", {
    json: courseBundle(),
    target: { kind: "pack" },
  });
  expect(imported.ok).toBe(true);
  const [cardsAnswer, packsAnswer] = await Promise.all([
    localGet<{ cards: Card[] }>("/api/cards"),
    localGet<{ packs: PackStatus[] }>("/api/packs"),
  ]);
  const pack = packsAnswer.packs.find((entry) => entry.name === "polish");
  if (!pack) throw new Error("the imported pack is missing");
  return { cards: cardsAnswer.cards, pack };
}

function cardNamed(cards: Card[], summary: string): Card {
  const found = cards.find((card) => card.summary === summary);
  if (!found) throw new Error(`no card named ${summary}`);
  return found;
}

async function savePage(body: Record<string, unknown>): Promise<DictionaryPage> {
  const id = String(body.id);
  const { page } = await localSend<{ page: DictionaryPage }>(
    `/api/pages/${encodeURIComponent(id)}`,
    "PATCH",
    body,
  );
  return page;
}

function saveCardPage(card: Card, parts: TeachingPart[] = CARD_PARTS): Promise<DictionaryPage> {
  return savePage({
    id: cardPageId(card.id),
    level: "card",
    packName: "polish",
    deckId: card.deckId,
    cardId: card.id,
    parts,
  });
}

async function trace(id: string, index: number): Promise<PageTrace> {
  const { trace: stored } = await localSend<{ trace: PageTrace }>(
    `/api/pages/${encodeURIComponent(id)}/traced`,
    "POST",
    { index },
  );
  return stored;
}

beforeEach(async () => {
  const store = new MemoryStore();
  setBrowserStore(store);
  await writeMeta("seeded", "yes", store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

describe("course dictionary rehearsal", () => {
  it("scenario 1: a card page steps one part at a time", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    const page = await saveCardPage(card);
    const loaded = await localGet<{ pages: DictionaryPage[] }>("/api/pages?pack=polish");
    expect(loaded.pages.map((entry) => entry.level)).toEqual(["card"]);
    expect(loaded.pages[0].parts.map((part) => part.type)).toEqual(["text", "image", "video"]);

    const first = await trace(page.id, 0);
    expect(first.traced).toEqual([0]);
    expect(first.readAt).toBeUndefined();
    const second = await trace(page.id, 1);
    expect(second.traced).toEqual([0, 1]);
    const third = await trace(page.id, 2);
    expect(third.traced).toEqual([0, 1, 2]);
    expect(third.readAt).toBeTruthy();

    const css = source("app", "globals.css");
    const panel = /\.dict-step-stack\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    const part = /\.dict-step-part\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    const nav = /\.dict-step-nav\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    const threeParts = loaded.pages[0].parts.length === 3;

    scenario(
      1,
      "card page steps 1 of 3, previous and next at bottom right",
      threeParts &&
        first.traced.length === 1 &&
        third.readAt !== undefined &&
        panel.includes("display: grid") &&
        part.includes("grid-area: 1 / 1") &&
        nav.includes("justify-content: flex-end"),
      "three ordered parts; the stack holds the tallest part; the arrows sit at the right edge",
    );
  });

  it("scenario 2: reading is earned by traces", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    const page = await saveCardPage(card);
    const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");
    expect(tracedTextMs("one two three")).toBe(5000);
    expect(tracedTextMs(words)).toBe(6000);
    expect(PICTURE_SECONDS).toBe(3);
    expect(VIDEO_TRACED_SHARE).toBe(0.8);

    await trace(page.id, 0);
    const kept = await localGet<{ pages: DictionaryPage[]; traces: PageTrace[] }>("/api/pages?pack=polish");
    expect(kept.traces[0].traced).toEqual([0]);
    expect(pageIsRead(kept.pages[0], kept.traces[0])).toBe(false);

    await trace(page.id, 1);
    const partial = await readTrace(page.id);
    expect(pageIsRead(page, partial)).toBe(false);
    await trace(page.id, 2);
    const done = await readTrace(page.id);
    expect(pageIsRead(page, done)).toBe(true);

    // WHY: the linked player reports its own position. The listener may only
    // attach once the ready probe has mounted the iframe, so the effect must
    // run again when that state flips; depending on onProgress alone never
    // attaches it and a YouTube part could never earn its 80% trace.
    const mediaSource = source("app", "TeachingMedia.tsx");
    const youtubeWired =
      mediaSource.includes('state !== "ready"') &&
      mediaSource.includes('window.addEventListener("message", onMessage)') &&
      mediaSource.includes("[onProgress, state]");
    expect(youtubeWired).toBe(true);

    scenario(
      2,
      "text dwell 5s floor, picture 3s, video 80%, traces survive leaving",
      done?.traced.length === 3 &&
        done.readAt !== undefined &&
        partial?.traced.length === 2 &&
        youtubeWired,
      "a part traces one at a time; a linked video listens once its player is ready",
    );
  });

  it("scenario 3: reading shows coverage, never score", async () => {
    const { cards } = await importedCourse();
    const coffee = cardNamed(cards, "Coffee");
    const water = cardNamed(cards, "Water");
    await saveCardPage(coffee);
    await saveCardPage(water, [{ type: "text", text: "Water is poured, not sipped." }]);
    await savePage({
      id: packPageId("polish"),
      level: "pack",
      packName: "polish",
      title: "Polish",
      lead: "A short course.",
      parts: [],
    });
    await savePage({
      id: deckPageId("polish", "basics"),
      level: "deck",
      packName: "polish",
      deckId: "basics",
      lead: "The basics.",
      parts: [],
    });

    const before = await localGet<{ progress: Record<string, unknown>; pages: { read: number; total: number } }>(
      "/api/progress",
    );
    expect(before.pages).toEqual({ read: 0, total: 2 });
    expect("pages" in before.progress).toBe(false);

    await trace(cardPageId(coffee.id), 0);
    await trace(cardPageId(coffee.id), 1);
    await trace(cardPageId(coffee.id), 2);
    const after = await localGet<{ progress: unknown; pages: { read: number; total: number } }>("/api/progress");
    expect(after.pages).toEqual({ read: 1, total: 2 });

    const evidence = await localGet<{ rows: unknown[] }>(`/api/evidence?cardId=${encodeURIComponent(coffee.id)}`);
    expect(evidence.rows).toHaveLength(0);

    const progressSource = source("app", "progress", "ProgressClient.tsx");
    scenario(
      3,
      "pages read 1 of 2, answers untouched",
      after.pages.read === 1 &&
        after.pages.total === 2 &&
        evidence.rows.length === 0 &&
        progressSource.includes("Pages read") &&
        progressSource.includes("not a score"),
      "coverage is its own line; tracing writes no evidence row",
    );
  });

  it("scenario 4: where pages open from", async () => {
    const files: Array<[string, string, string]> = [
      ["the library card row's book button", "library/CardsPanel.tsx", "/dictionary?card="],
      ["the study card's Dictionary button", "study/StudyCard.tsx", "dictionaryHref"],
      ["the teaching layer's link", "study/TeachingLayer.tsx", "Open the full card page"],
      ["the Study from dropdown's pack arrow", "study/ScopePicker.tsx", "/dictionary?pack="],
      ["the Study from dropdown's deck arrow", "study/ScopePicker.tsx", "&deck="],
      ["the Course Builder tree", "BuilderClient.tsx", "targetHref"],
      ["deck pages opening card pages", "dictionary/EntityPage.tsx", "&card="],
    ];
    const missing = files.filter(([, file, needle]) => !source("app", file).includes(needle));
    scenario(
      4,
      "library, study card, teaching layer, scope arrows and builder all open pages",
      missing.length === 0,
      missing.length === 0 ? "all entry points are wired" : `missing: ${missing.map(([name]) => name).join(", ")}`,
    );
  });

  it("scenario 5: a course rule warns, never blocks", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    await saveCardPage(card);
    await localSend("/api/packs/polish", "PATCH", { requirePageRead: true });
    const packs = await localGet<{ packs: PackStatus[] }>("/api/packs");
    expect(packs.packs.find((entry) => entry.name === "polish")?.requirePageRead).toBe(true);

    const answer = await localSend<{ rows: unknown[] }>("/api/answer", "POST", {
      cardId: card.id,
      answers: { b1: "nie" },
      timeMs: 900,
    });
    expect(answer.rows.length).toBeGreaterThan(0);
    expect(await readTrace(cardPageId(card.id))).toBeNull();

    const study = source("app", "study", "StudyCard.tsx");
    const css = source("app", "globals.css");
    const toolRule = /\.study-tool \{[^}]*\}/.exec(css)?.[0] ?? "";
    const chipRule = /\.study-chip \{[^}]*\}/.exec(css)?.[0] ?? "";
    const narrow = /\.study-tool,\s*\.study-chip \{[^}]*\}/.exec(css)?.[0] ?? "";
    // GRILL 11, 12 and 15: a book or check icon, the words as accessible name
    // and tooltip, an 8px corner, and icon-only 34x34 buttons on a narrow screen.
    const chipWired =
      study.includes("study-chip") &&
      study.includes('aria-label={pageRead ? "Page read" : "Page not read"}') &&
      study.includes(
        'title={pageRead ? "Page read — open the card page" : "Page not read — open the card page"}',
      ) &&
      study.includes('aria-label="Dictionary"') &&
      study.includes('title="Dictionary — open the card page"') &&
      study.includes('title="Ask for a hint"');
    const corners = toolRule.includes("border-radius: 8px") && chipRule.includes("border-radius: 8px");
    const narrowButtons = narrow.includes("width: 34px") && narrow.includes("height: 34px");
    expect(chipWired && corners && narrowButtons).toBe(true);

    scenario(
      5,
      "the rule stores, the answer records, the page stays unread",
      answer.rows.length > 0 &&
        study.includes("This course asks you to read the card page first. Your answer still counts.") &&
        study.includes("Page not read") &&
        study.includes("Page read") &&
        study.includes("askPageRead && hasPage") &&
        chipWired &&
        corners &&
        narrowButtons,
      "every answer button stays live; the chip and tools carry names, tooltips, 8px corners and 34px icon buttons",
    );
  });

  it("scenario 6: pack and deck pages are covers, not dashboards", async () => {
    await importedCourse();
    const packPage = await savePage({
      id: packPageId("polish"),
      level: "pack",
      packName: "polish",
      title: "The Polish course",
      lead: "Everything you need for the first month.",
      cover: { type: "image", source: "web", src: "https://example.test/cover.png", alt: "A street in Kraków" },
      parts: [],
    });
    const deckPage = await savePage({
      id: deckPageId("polish", "basics"),
      level: "deck",
      packName: "polish",
      deckId: "basics",
      title: "Basics",
      lead: "Greetings and the first verbs.",
      parts: [],
    });
    const loaded = await localGet<{ pages: DictionaryPage[] }>("/api/pages?pack=polish");
    expect(loaded.pages.find((page) => page.id === packPage.id)?.cover?.src).toBe("https://example.test/cover.png");
    expect(loaded.pages.find((page) => page.id === deckPage.id)?.lead).toBe("Greetings and the first verbs.");

    const css = source("app", "globals.css");
    const cover = /\.dict-cover \.teaching-media\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    const list = /\.dict-list\.scroll\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    const entity = source("app", "dictionary", "EntityPage.tsx");
    // GRILL 19: Escape or a press outside closes the search and clears the filter.
    const searchClose =
      entity.includes('event.key !== "Escape"') &&
      entity.includes('document.addEventListener("pointerdown", onPointer)') &&
      /const close = \(\) => \{\s*setQuery\(""\);\s*setSearchOpen\(false\);\s*\}/.test(entity);
    expect(searchClose).toBe(true);
    scenario(
      6,
      "cover band, promise, scrolling contents and a slim search",
      Boolean(packPage.cover) &&
        cover.includes("clamp(160px, 30vh, 300px)") &&
        list.includes("max-height: min(46vh, 420px)") &&
        list.includes("scrollbar-width: none") &&
        entity.includes("dict-list scroll") &&
        entity.includes("Search decks") &&
        entity.includes("Search cards") &&
        searchClose,
      "the cover leads, the list is capped and scrolls without a bar, search closes on Escape or a press outside",
    );
  });

  it("scenario 7: authoring keeps or links media", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    const record = await putMedia({
      blob: new Blob(["png bytes"], { type: "image/png" }),
      mime: "image/png",
      kind: "image",
    });
    const page = await saveCardPage(card, [
      { type: "text", text: "Coffee arrives as a picture." },
      { type: "image", source: "local", src: record.id, alt: "A kept picture" },
      { type: "video", source: "youtube", src: "dQw4w9WgXcQ" },
    ]);
    expect(await deleteUnreferenced()).toEqual([]);
    expect(page.parts[1]).toMatchObject({ source: "local", src: record.id });
    expect(page.parts[2]).toMatchObject({ source: "youtube", src: "dQw4w9WgXcQ" });

    const archive = await exportPackArchive("polish");
    if (!archive.ok) throw new Error(archive.message);
    expect(archive.fileName.endsWith(".zip")).toBe(true);
    const bytes = new Uint8Array(await archive.blob.arrayBuffer());
    const files = unzipSync(bytes);
    const packJson = JSON.parse(strFromU8(files["pack.json"]));
    expect(packJson.pages[0].parts[1].src).toBe(record.id);
    expect(files[`media/${record.id}.png`]).toBeTruthy();

    expect(fitImage(4000, 2000)).toEqual({ width: 1600, height: 800 });
    expect(videoBytesProblem(20_000_001)).toBe(VIDEO_TOO_LARGE);
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES, 1)).not.toBeNull();
    expect(mediaCapProblem(10, 10)).toBeNull();
    // GRILL 26: replacing or removing a kept file frees its room at once.
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES - 10, 20)).not.toBeNull();
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES - 10, 20, 50)).toBeNull();
    const water = cardNamed(cards, "Water");
    const spare = await putMedia({
      blob: new Blob(["jpeg bytes"], { type: "image/jpeg" }),
      mime: "image/jpeg",
      kind: "image",
    });
    await saveCardPage(water, [{ type: "image", source: "local", src: spare.id, alt: "A kept picture" }]);
    expect(await deleteMediaIfUnreferenced(spare.id)).toBe(false);
    expect(await getMedia(spare.id)).not.toBeNull();
    await saveCardPage(water, [{ type: "text", text: "Water is poured, not sipped." }]);
    expect(await deleteMediaIfUnreferenced(spare.id)).toBe(true);
    expect(await getMedia(spare.id)).toBeNull();
    const editor = source("app", "dictionary", "PageEditor.tsx");
    const quotaWired =
      editor.includes("deleteMediaIfUnreferenced(") &&
      editor.includes("replacingBytesFor(") &&
      (editor.match(/await replacingBytesFor\(replaced\)/g) ?? []).length >= 3;
    expect(quotaWired).toBe(true);
    expect(isTouchFirstMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe(true);
    expect(
      isTouchFirstMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5),
    ).toBe(true);
    expect(isTouchFirstMobile("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0", 10)).toBe(false);
    expect(MOBILE_VIDEO_LINK_ONLY).toContain("linked");

    scenario(
      7,
      "kept picture travels in the pack zip, video is linked, limits hold",
      archive.fileName.endsWith(".zip") &&
        Boolean(files[`media/${record.id}.png`]) &&
        packJson.pages[0].parts[1].src === record.id &&
        quotaWired,
      "kept media stays referenced and rides in the zip; replacing or removing it frees the cap",
    );
  });

  it("scenario 8: a draft is reviewed, never saved", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    const prepared = await localSend<{ requestId: string; prompt: string }>("/api/pages/draft", "POST", {
      level: "card",
      packName: "polish",
      deckId: card.deckId,
      cardId: card.id,
      instruction: "Explain when to use kawę.",
    });
    const prompt = prepared.prompt;
    const allowed =
      prompt.includes("Card summary: Coffee") &&
      prompt.includes("Pack name: polish.") &&
      prompt.includes("The cards teach: pl.") &&
      prompt.includes("The questions are written in: en.") &&
      prompt.includes("Instruction: Explain when to use kawę.");
    const thinks = prompt.toLowerCase();
    const quiet =
      !thinks.includes("evidence") && !thinks.includes("settings") && !thinks.includes("backup");

    const empty = await localGet<{ pages: DictionaryPage[] }>("/api/pages?pack=polish");
    expect(empty.pages).toHaveLength(0);

    let refused = "";
    try {
      await localSend("/api/pages/draft/send", "POST", { requestId: prepared.requestId });
    } catch (problem) {
      refused = problem instanceof Error ? problem.message : "failed";
    }
    const after = await localGet<{ pages: DictionaryPage[] }>("/api/pages?pack=polish");
    expect(after.pages).toHaveLength(0);

    let reused = "";
    try {
      await localSend("/api/pages/draft/send", "POST", { requestId: prepared.requestId });
    } catch (problem) {
      reused = problem instanceof Error ? problem.message : "failed";
    }

    scenario(
      8,
      "one prepared prompt, names and instruction only, nothing saved",
      allowed && quiet && after.pages.length === 0 && refused.length > 0 && reused.length > 0,
      "the prompt sees the course facts; the answer never lands in the library on its own",
    );
  });

  it("scenario 9: a built-in course stays one course", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    const id = cardPageId(card.id);
    const shipped: DictionaryPage = {
      id,
      level: "card",
      packName: "polish",
      deckId: card.deckId,
      cardId: card.id,
      title: "Shipped coffee",
      parts: [{ type: "text", text: "The shipped words." }],
      createdAt: "2026-10-29T09:00:00.000Z",
      updatedAt: "2026-10-29T09:00:00.000Z",
    };
    expect(await writeShippedPage(shipped)).toBe(true);

    const edited = await saveCardPage(card, [{ type: "text", text: "My words." }]);
    expect(edited.learnerEdited).toBe(true);
    expect(edited.editedFromShipped).toBe(true);
    expect(edited.shippedCopy?.title).toBe("Shipped coffee");
    expect(edited.shippedCopy?.parts).toEqual([{ type: "text", text: "The shipped words." }]);

    // A later course update leaves the learner's words alone and refreshes
    // what a revert would restore.
    const secondEdition: DictionaryPage = {
      ...shipped,
      title: "Shipped coffee, second edition",
      parts: [{ type: "text", text: "The newest shipped words." }],
      updatedAt: "2026-10-29T10:00:00.000Z",
    };
    expect(await writeShippedPage(secondEdition)).toBe(false);
    const kept = await readPage(id);
    expect(kept?.parts).toEqual([{ type: "text", text: "My words." }]);
    expect(kept?.shippedCopy?.title).toBe("Shipped coffee, second edition");
    expect(kept?.shippedCopy?.parts).toEqual([{ type: "text", text: "The newest shipped words." }]);

    // GRILL 6: sharing the pack carries the shipped page, never the learner's words.
    const packExport = await localGet<{ json: string }>("/api/packs/export?name=polish");
    const shared = JSON.parse(packExport.json) as {
      pages: Array<{ cardId?: string; parts: TeachingPart[] }>;
    };
    const sharedCard = shared.pages.find((page) => page.cardId === card.id);
    expect(sharedCard?.parts).toEqual([{ type: "text", text: "The newest shipped words." }]);
    expect(packExport.json).not.toContain("My words.");

    await trace(id, 0);
    expect((await readTrace(id))?.readAt).toBeTruthy();

    // Revert returns the shipped copy at once, with no reseed, and drops the
    // trace that proved a body no longer on screen.
    const answer = await localSend<{ deleted: boolean; page: DictionaryPage | null }>(
      `/api/pages/${encodeURIComponent(id)}`,
      "DELETE",
    );
    const restored = await readPage(id);
    expect(answer.page?.title).toBe("Shipped coffee, second edition");
    expect(restored?.title).toBe("Shipped coffee, second edition");
    expect(restored?.parts).toEqual([{ type: "text", text: "The newest shipped words." }]);
    expect(restored?.learnerEdited).toBeUndefined();
    expect(restored?.editedFromShipped).toBeUndefined();
    expect(restored?.shippedCopy).toBeUndefined();
    expect(await readTrace(id)).toBeNull();

    scenario(
      9,
      "edit is an overlay, a course update leaves it, revert brings the shipped page at once",
      edited.editedFromShipped === true &&
        kept?.parts.length === 1 &&
        sharedCard?.parts.length === 1 &&
        restored?.title === "Shipped coffee, second edition" &&
        (await readTrace(id)) === null,
      "the overlay keeps its own words; packs carry the shipped copy; revert restores it without waiting for a seed",
    );
  });

  it("scenario 10: pages travel, traces stay the learner's", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    await savePage({
      id: packPageId("polish"),
      level: "pack",
      packName: "polish",
      title: "Polish",
      lead: "A short course.",
      parts: [],
    });
    await savePage({
      id: deckPageId("polish", "basics"),
      level: "deck",
      packName: "polish",
      deckId: "basics",
      lead: "The basics.",
      parts: [],
    });
    await saveCardPage(card);
    await trace(cardPageId(card.id), 0);

    const packExport = await localGet<{ json: string }>("/api/packs/export?name=polish");
    const packJson = JSON.parse(packExport.json);
    expect(packJson.pages).toHaveLength(3);
    expect(packJson.pages.some((page: { level: string }) => page.level === "card")).toBe(true);
    expect(packJson.pages.some((page: { level: string }) => page.level === "deck")).toBe(true);
    expect(packJson.pages.some((page: { level: string }) => page.level === "pack")).toBe(true);
    expect("traces" in packJson).toBe(false);
    expect("pageTraces" in packJson).toBe(false);

    const backupExport = await localGet<{ json: string }>("/api/backup/export");
    const backup = JSON.parse(backupExport.json);
    expect(backup.pages).toHaveLength(3);
    expect(backup.pageTraces).toHaveLength(1);
    expect(backup.pageTraces[0]).toMatchObject({ id: cardPageId(card.id), traced: [0] });

    expect(backupSizeWarning(160_000_000)).toContain("phone or tablet");
    expect(backupSizeWarning(1_000_000)).toBeNull();

    // A learner's backup carries the overlay and the shipped copy kept beside
    // it, so a restore can still revert.
    const water = cardNamed(cards, "Water");
    const waterId = cardPageId(water.id);
    await writeShippedPage({
      id: waterId,
      level: "card",
      packName: "polish",
      deckId: water.deckId,
      cardId: water.id,
      title: "Shipped water",
      parts: [{ type: "text", text: "The shipped water." }],
      createdAt: "2026-10-29T09:00:00.000Z",
      updatedAt: "2026-10-29T09:00:00.000Z",
    });
    await saveCardPage(water, [{ type: "text", text: "My water." }]);
    const withOverlay = JSON.parse((await localGet<{ json: string }>("/api/backup/export")).json) as {
      pages: Array<{ id: string; parts: TeachingPart[]; shippedCopy?: { title?: string } }>;
    };
    const overlayRow = withOverlay.pages.find((page) => page.id === waterId);
    expect(overlayRow?.parts).toEqual([{ type: "text", text: "My water." }]);
    expect(overlayRow?.shippedCopy?.title).toBe("Shipped water");

    // GRILL 29: the size is stated before a backup builds, in Settings only;
    // the background autosave keeps running without a prompt.
    const settings = source("app", "settings", "SettingsClient.tsx");
    const statesSize =
      settings.includes("backupMediaBytes()") &&
      settings.includes("backupSizeWarning(backupAsk)") &&
      settings.includes("This backup holds about") &&
      settings.includes("Build the backup") &&
      (settings.match(/askBackup\(\)/g) ?? []).length >= 2;
    expect(statesSize).toBe(true);
    expect(source("lib", "browser", "archive.ts").includes("backupSizeWarning")).toBe(false);

    scenario(
      10,
      "pack export carries pages, never traces; the backup carries both and states its size",
      packJson.pages.length === 3 &&
        !("pageTraces" in packJson) &&
        backup.pages.length === 3 &&
        backup.pageTraces.length === 1 &&
        overlayRow?.shippedCopy?.title === "Shipped water" &&
        statesSize,
      "sharing moves course material; reading proof stays on this device; the size is shown before a backup builds",
    );
  });

  it("scenario 11: a page edit is not a card edit", async () => {
    const { cards } = await importedCourse();
    const card = cardNamed(cards, "Coffee");
    await localSend("/api/answer", "POST", { cardId: card.id, answers: { b1: "kawę" }, timeMs: 1200 });
    const beforeCards = await localGet<{ cards: Card[] }>("/api/cards");
    const beforeEvidence = await localGet<{ rows: unknown[] }>(
      `/api/evidence?cardId=${encodeURIComponent(card.id)}`,
    );
    await saveCardPage(card);
    const afterCards = await localGet<{ cards: Card[] }>("/api/cards");
    const afterEvidence = await localGet<{ rows: unknown[] }>(
      `/api/evidence?cardId=${encodeURIComponent(card.id)}`,
    );
    expect(afterCards.cards).toEqual(beforeCards.cards);
    expect(afterEvidence.rows).toHaveLength(beforeEvidence.rows.length);
    expect(beforeEvidence.rows.length).toBeGreaterThan(0);

    scenario(
      11,
      "saving the page leaves the card and every evidence row alone",
      afterCards.cards.length === beforeCards.cards.length &&
        afterEvidence.rows.length === beforeEvidence.rows.length,
      "the page record changes; the card and its answer history do not",
    );
  });

  it("the built screens carry the dictionary", async () => {
    if (!hasBuild) {
      console.log("BUILD dictionary route and copy -> SKIP (no build found)");
      return;
    }
    const text = await builtSources();
    const route =
      existsSync(join(projectRoot, "out", "dictionary.html")) ||
      existsSync(join(projectRoot, "out", "dictionary", "index.html"));
    const words = [
      "Course Builder",
      "Open the full card page",
      "Page not read",
      "Pages read",
      "Read the card page",
      "Page not written.",
    ];
    const missing = words.filter((word) => !text.includes(word));
    const cssHooks = [".dict-step-nav", ".dict-step-stack", ".dict-list.scroll", ".dict-cover"].filter(
      (hook) => !text.includes(hook),
    );
    const pass = route && missing.length === 0 && cssHooks.length === 0;
    console.log(`BUILD dictionary route and copy -> ${pass ? "PASS" : "FAIL"}`);
    expect(
      pass,
      route
        ? `missing words=${missing.join(", ")} missing hooks=${cssHooks.join(", ")}`
        : "the exported build has no dictionary route",
    ).toBe(true);
  });
});
