// WHY: Pages and their reading traces are two different kinds of fact. A page
// is content the learner owns or a pack ships; a trace is device-local proof
// that this browser showed every part. Keeping the two in one place means the
// builder, the reader and the seed cannot disagree about which is which.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import type { DictionaryPage, PageTrace } from "@/lib/shared/types";
import { pageContent, pageIdFor, withTracedPart, type SavedPage, pageFromSave } from "@/lib/core/pages";
import { browserStore, type Store } from "@/lib/browser/store";
import { markChanged } from "@/lib/browser/changes";

/** Every page, or only the pages of one pack. */
export async function readPages(packName?: string, store: Store = browserStore()): Promise<DictionaryPage[]> {
  const pages = await store.all<DictionaryPage>("pages");
  if (!packName) return pages;
  return pages.filter((page) => page.packName === packName);
}

/** One page by its id, or null when nobody wrote it yet. */
export function readPage(id: string, store: Store = browserStore()): Promise<DictionaryPage | null> {
  return store.get<DictionaryPage>("pages", id);
}

/** Add or replace one page. A learner save through `pageFromSave` is an overlay. */
export function writePage(page: DictionaryPage, store: Store = browserStore()): Promise<void> {
  return store.put("pages", page).then(() => markChanged());
}

/**
 * Save one validated page. The row keeps its first-created time and always
 * carries the overlay mark, so a seed never replaces the learner's copy.
 */
export async function savePage(save: SavedPage, at: string, store: Store = browserStore()): Promise<DictionaryPage> {
  const id = pageIdForSave(save);
  const previous = await readPage(id, store);
  const page = pageFromSave(save, previous, at);
  await writePage(page, store);
  return page;
}

/** The id a validated save will write to. */
function pageIdForSave(save: SavedPage): string {
  return pageIdFor(save.level, save.packName, save.deckId, save.cardId);
}

/**
 * Write a page that came from a pack file, but never over the learner's own
 * copy. An overlay still learns what the newest shipped page says, so a later
 * revert restores the course as it is now. Returns whether the row was written.
 */
export async function writeShippedPage(page: DictionaryPage, store: Store = browserStore()): Promise<boolean> {
  const existing = await readPage(page.id, store);
  if (existing?.learnerEdited) {
    if (existing.editedFromShipped) {
      const refreshed: DictionaryPage = { ...existing, shippedCopy: pageContent(page) };
      await store.put("pages", refreshed);
      markChanged();
    }
    return false;
  }
  await writePage(page, store);
  return true;
}

/** Remove one page and the trace that proves it was read. */
export async function deletePage(id: string, store: Store = browserStore()): Promise<void> {
  await store.delete("pages", id);
  await store.delete("pageTraces", id);
  markChanged();
}

/**
 * Remove the learner's copy of a shipped page. The copy kept when the overlay
 * was first written returns at once; the trace goes because it proved a body
 * that is no longer on screen. A page with no shipped copy is simply removed.
 */
export async function revertPage(
  id: string,
  at: string,
  store: Store = browserStore(),
): Promise<DictionaryPage | null> {
  const page = await readPage(id, store);
  if (!page) return null;
  if (!page.shippedCopy) {
    await deletePage(id, store);
    return null;
  }
  const restored: DictionaryPage = {
    id: page.id,
    level: page.level,
    packName: page.packName,
    ...(page.deckId !== undefined ? { deckId: page.deckId } : {}),
    ...(page.cardId !== undefined ? { cardId: page.cardId } : {}),
    ...page.shippedCopy,
    createdAt: page.createdAt,
    updatedAt: at,
  };
  await writePage(restored, store);
  await store.delete("pageTraces", id);
  markChanged();
  return restored;
}

/** Every reading trace in this browser. */
export function readTraces(store: Store = browserStore()): Promise<PageTrace[]> {
  return store.all<PageTrace>("pageTraces");
}

/** One page's trace, or null when the page has never been read here. */
export function readTrace(id: string, store: Store = browserStore()): Promise<PageTrace | null> {
  return store.get<PageTrace>("pageTraces", id);
}

/** Store one trace as it is; only a restore replaces a trace wholesale. */
export function writeTrace(trace: PageTrace, store: Store = browserStore()): Promise<void> {
  return store.put("pageTraces", trace).then(() => markChanged());
}

/**
 * Record that one part of a page was traced. A missing page records nothing;
 * a part outside the page records nothing extra but still updates the time.
 */
export async function recordTracedPart(
  pageId: string,
  part: number,
  at: string,
  store: Store = browserStore(),
): Promise<PageTrace | null> {
  const page = await readPage(pageId, store);
  if (!page) return null;
  const previous = await readTrace(pageId, store);
  const trace = withTracedPart(page, previous, part, at);
  await store.put("pageTraces", trace);
  markChanged();
  return trace;
}
