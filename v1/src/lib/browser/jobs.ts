// WHY: Generation and import are long enough that the learner should be able
// to leave Create. This module owns the page-level queue, the persisted job
// states and the one runner that writes results back to the library.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]

import { newId } from "@/lib/core/id";
import type { RepairKind } from "@/lib/core/json-repair";
import { importBundle, type ImportTarget } from "@/lib/browser/bundle";
import { generateFromPrepared, type GenerationResult } from "@/lib/browser/provider";
import { ProviderTimeoutError } from "@/lib/provider/client";
import type { PreparedRequest } from "@/lib/provider/prepare";
import { browserStore } from "@/lib/browser/store";

export type JobKind = "generation" | "import";
export type JobStatus = "queued" | "running" | "waiting" | "succeeded" | "failed";
export type JobTargetKind = "pack" | "deck" | "cards";

/** What a finished job made, in the small shape the notice and link need. */
export interface JobResult {
  kind: JobTargetKind;
  packName: string;
  deckId: string | null;
  count: number;
  decksAdded: number;
  duplicates: number;
  /** Syntax repairs the imported file needed; absent when it was already valid. */
  repairs?: RepairKind[];
}

/** The job shape the screen and the routes may see. The payload stays private. */
export interface JobView {
  id: string;
  kind: JobKind;
  status: JobStatus;
  title: string;
  detail: string;
  targetKind: JobTargetKind;
  packName: string | null;
  deckId: string | null;
  count: number | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  errorDetails: string[];
  result: JobResult | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

/** Generation jobs keep the exact prompt the learner approved. */
export interface GenerationJobPayload {
  kind: "generation";
  prepared: PreparedRequest;
}

/** Import jobs keep the file text and the target they chose. */
export interface ImportJobPayload {
  kind: "import";
  text: string;
  target: ImportTarget;
  namePolicy: "strict" | "auto-suffix";
  source: "file" | "chat";
}

export type JobPayload = GenerationJobPayload | ImportJobPayload;

/** The full stored shape. Only the runner reads payload. */
export interface BrowserJob extends JobView {
  payload: JobPayload;
}

/** One initial try plus three retries; the import has one try. */
export const MAX_GENERATION_ATTEMPTS = 4;
export const MAX_IMPORT_ATTEMPTS = 1;
export const RETRY_DELAY_MS = 60_000;
export const FINISHED_LIMIT = 20;

const EMPTY_VIEWS: JobView[] = [];

/** One problem an import can explain without losing its field details. */
class ImportJobError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[]) {
    super(message);
    this.name = "ImportJobError";
    this.details = details;
  }
}

function jobStore() {
  return browserStore();
}

function active(status: JobStatus): boolean {
  return status === "queued" || status === "running" || status === "waiting";
}

function terminal(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed";
}

function cardWord(count: number): string {
  return count === 1 ? "card" : "cards";
}

function generationLabels(prepared: PreparedRequest): { title: string; detail: string } {
  const count = prepared.count ?? 1;
  const target = prepared.targetKind ?? "cards";
  const title = `Generate ${count} ${cardWord(count)}`;
  if (target === "pack") return { title, detail: "New pack" };
  if (target === "deck") return { title, detail: prepared.packName ?? "Pack" };
  const deck = prepared.topic ?? prepared.deckId ?? "Deck";
  return { title, detail: `${prepared.packName ?? "Pack"} → ${deck}` };
}

function importLabels(payload: ImportJobPayload): { title: string; detail: string } {
  const target = payload.target;
  const title =
    payload.source === "chat"
      ? "Save chat answer"
      : target.kind === "pack"
        ? "Import pack"
        : target.kind === "deck"
          ? "Import decks"
          : "Import cards";
  const detail =
    target.kind === "pack"
      ? "New pack"
      : target.kind === "deck"
        ? target.packName
        : `${target.packName} → ${target.deckId}`;
  return { title, detail };
}

function importFailure(issues: Array<{ field: string; message: string }>): ImportJobError {
  return new ImportJobError(
    "Nothing was imported, because the file needs fixing.",
    issues.map((entry) => `${entry.field}: ${entry.message}`),
  );
}

function resultFromGeneration(result: GenerationResult): JobResult {
  return {
    kind: result.kind,
    packName: result.packName,
    deckId: result.deckId ?? null,
    count: result.count,
    decksAdded: 0,
    duplicates: 0,
  };
}

/** The View target. A pack or deck lands in Packs; cards land in the Cards tab. */
export function jobResultHref(result: JobResult): string {
  const pack = encodeURIComponent(result.packName);
  if (result.kind === "cards" && result.deckId) {
    return `/library?pack=${pack}&deck=${encodeURIComponent(result.deckId)}`;
  }
  return `/library?pack=${pack}`;
}

export function jobHref(job: JobView): string | null {
  return job.result ? jobResultHref(job.result) : null;
}

function toView(job: BrowserJob): JobView {
  const { payload, ...view } = job;
  void payload;
  return view;
}

async function readJobs(): Promise<BrowserJob[]> {
  return jobStore().all<BrowserJob>("jobs");
}

async function readJob(id: string): Promise<BrowserJob | null> {
  return jobStore().get<BrowserJob>("jobs", id);
}

export async function readJobViews(): Promise<JobView[]> {
  const jobs = await readJobs();
  return jobs
    .map(toView)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

async function writeJob(
  job: BrowserJob,
  options: { announce?: boolean } = {},
): Promise<JobView> {
  const stored: BrowserJob = { ...job, updatedAt: new Date().toISOString() };
  await jobStore().put("jobs", stored);
  const view = toView(stored);
  if (options.announce && terminal(stored.status)) {
    for (const listener of finishedListeners) {
      try {
        listener(view);
      } catch {
        // A notice listener must never stop the job from being stored.
      }
    }
  }
  await refreshViews();
  return view;
}

async function deleteJob(id: string): Promise<void> {
  await jobStore().delete("jobs", id);
  await refreshViews();
}

// Views are the only thing the UI reads. A sequence guard keeps two quick
// writes from letting an older read paint over a newer state.
let views: JobView[] = EMPTY_VIEWS;
let viewSeq = 0;
const subscribers = new Set<() => void>();
const finishedListeners = new Set<(job: JobView) => void>();

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

async function refreshViews(): Promise<void> {
  const seq = ++viewSeq;
  const next = await readJobViews();
  if (seq !== viewSeq) return;
  views = next;
  notify();
}

export function subscribeJobs(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getJobsSnapshot(): JobView[] {
  return views;
}

export function getServerJobsSnapshot(): JobView[] {
  return EMPTY_VIEWS;
}

export function onJobFinished(listener: (job: JobView) => void): () => void {
  finishedListeners.add(listener);
  return () => {
    finishedListeners.delete(listener);
  };
}

/** Queue a generation whose prepared prompt was already taken from the hold. */
export async function enqueueGenerationJob(prepared: PreparedRequest): Promise<JobView> {
  if (prepared.kind !== "generation") {
    throw new Error("That prepared prompt is not a generation request.");
  }
  const now = new Date().toISOString();
  const labels = generationLabels(prepared);
  const job: BrowserJob = {
    id: newId(),
    kind: "generation",
    status: "queued",
    title: labels.title,
    detail: labels.detail,
    targetKind: prepared.targetKind ?? "cards",
    packName: prepared.packName,
    deckId: prepared.deckId ?? null,
    count: prepared.count,
    attempts: 0,
    maxAttempts: MAX_GENERATION_ATTEMPTS,
    nextAttemptAt: null,
    lastError: null,
    errorDetails: [],
    result: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    payload: { kind: "generation", prepared },
  };
  const view = await writeJob(job);
  wakeJobs();
  return view;
}

/** Queue one import. Nothing is parsed until the runner picks it up. */
export async function enqueueImportJob(input: {
  text: string;
  target: ImportTarget;
  namePolicy?: "strict" | "auto-suffix";
  source?: "file" | "chat";
}): Promise<JobView> {
  if (!input.text.trim()) throw new Error("Paste the bundle as JSON before importing.");
  const now = new Date().toISOString();
  const payload: ImportJobPayload = {
    kind: "import",
    text: input.text,
    target: input.target,
    namePolicy: input.namePolicy ?? "strict",
    source: input.source ?? "file",
  };
  const labels = importLabels(payload);
  const job: BrowserJob = {
    id: newId(),
    kind: "import",
    status: "queued",
    title: labels.title,
    detail: labels.detail,
    targetKind: input.target.kind,
    packName: input.target.kind === "pack" ? null : input.target.packName,
    deckId: input.target.kind === "cards" ? input.target.deckId : null,
    count: null,
    attempts: 0,
    maxAttempts: MAX_IMPORT_ATTEMPTS,
    nextAttemptAt: null,
    lastError: null,
    errorDetails: [],
    result: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    payload,
  };
  const view = await writeJob(job);
  wakeJobs();
  return view;
}

/** A manual Try again replaces the failed row with a fresh queued row. */
export async function retryJob(id: string): Promise<JobView> {
  const old = await readJob(id);
  if (!old) throw new Error("That job is no longer here.");
  if (old.status !== "failed") throw new Error("Only a failed job can be tried again.");
  const now = new Date().toISOString();
  const job: BrowserJob = {
    ...old,
    id: newId(),
    status: "queued",
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    errorDetails: [],
    result: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
  const view = await writeJob(job);
  await deleteJob(old.id);
  wakeJobs();
  return view;
}

export async function dismissJob(id: string): Promise<void> {
  const job = await readJob(id);
  if (!job) throw new Error("That job is no longer here.");
  if (active(job.status)) throw new Error("A running job cannot be dismissed.");
  await deleteJob(id);
}

/** Mark every queued/running/waiting job failed before the library changes. */
export async function interruptJobs(reason: string): Promise<void> {
  const jobs = await readJobs();
  const now = new Date().toISOString();
  for (const job of jobs) {
    if (!active(job.status)) continue;
    await writeJob({
      ...job,
      status: "failed",
      nextAttemptAt: null,
      lastError: reason,
      errorDetails: [],
      finishedAt: now,
      updatedAt: now,
    });
  }
}

/** A page that opens after a crash cannot revive a provider call. */
export async function recoverInterruptedJobs(): Promise<void> {
  const jobs = await readJobs();
  const now = new Date().toISOString();
  for (const job of jobs) {
    if (job.status !== "running") continue;
    await writeJob({
      ...job,
      status: "failed",
      nextAttemptAt: null,
      lastError: "The page was reloaded before this job finished.",
      finishedAt: now,
      updatedAt: now,
    });
  }
}

/** Keep the recent history, never an active job. */
export async function pruneFinishedJobs(limit = FINISHED_LIMIT): Promise<void> {
  const jobs = await readJobs();
  const finished = jobs
    .filter((job) => terminal(job.status))
    .sort((left, right) => {
      const leftAt = Date.parse(left.finishedAt ?? left.updatedAt);
      const rightAt = Date.parse(right.finishedAt ?? right.updatedAt);
      return rightAt - leftAt;
    });
  for (const job of finished.slice(limit)) await deleteJob(job.id);
}

function readyAt(job: BrowserJob): number {
  if (job.status === "waiting") return Date.parse(job.nextAttemptAt ?? job.createdAt);
  return Date.parse(job.createdAt);
}

async function nextReadyJob(now = Date.now()): Promise<BrowserJob | null> {
  const jobs = await readJobs();
  const ready = jobs.filter(
    (job) => job.status === "queued" || (job.status === "waiting" && readyAt(job) <= now),
  );
  ready.sort((left, right) => readyAt(left) - readyAt(right));
  return ready[0] ?? null;
}

async function runGenerationJob(job: BrowserJob): Promise<JobResult> {
  if (job.payload.kind !== "generation") throw new Error("That job has no generation prompt.");
  return resultFromGeneration(await generateFromPrepared(job.payload.prepared));
}

async function runImportJob(job: BrowserJob): Promise<JobResult> {
  if (job.payload.kind !== "import") throw new Error("That job has no import text.");
  const imported = await importBundle(job.payload.text, job.payload.target, {
    namePolicy: job.payload.namePolicy,
  });
  if (!imported.ok) throw importFailure(imported.issues);
  return {
    kind: imported.kind,
    packName: imported.packName,
    deckId: imported.deckIds[0] ?? null,
    count: imported.cardsAdded,
    decksAdded: imported.decksAdded,
    duplicates: imported.duplicates,
    ...(imported.repairs ? { repairs: imported.repairs } : {}),
  };
}

/** Run one queued or due job and return its terminal/waiting state. */
async function runJob(job: BrowserJob): Promise<void> {
  const current = await readJob(job.id);
  if (!current || (current.status !== "queued" && current.status !== "waiting")) return;

  const started = new Date().toISOString();
  current.status = "running";
  current.attempts += 1;
  current.nextAttemptAt = null;
  current.lastError = null;
  current.errorDetails = [];
  current.updatedAt = started;
  await writeJob(current);

  try {
    const result = current.kind === "generation" ? await runGenerationJob(current) : await runImportJob(current);
    // Restore may have marked this job failed while the provider was answering.
    const stillRunning = await readJob(current.id);
    if (!stillRunning || stillRunning.status !== "running") return;
    await writeJob(
      {
        ...stillRunning,
        status: "succeeded",
        result,
        lastError: null,
        errorDetails: [],
        nextAttemptAt: null,
        finishedAt: new Date().toISOString(),
      },
      { announce: true },
    );
  } catch (problem) {
    const stillRunning = await readJob(current.id);
    if (!stillRunning || stillRunning.status !== "running") return;
    const message = problem instanceof Error ? problem.message : "The job stopped for an unknown reason.";
    const details = problem instanceof ImportJobError ? problem.details : [];
    if (problem instanceof ProviderTimeoutError && stillRunning.attempts < stillRunning.maxAttempts) {
      await writeJob({
        ...stillRunning,
        status: "waiting",
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
        lastError: message,
        errorDetails: details,
      });
      return;
    }
    const finalMessage =
      problem instanceof ProviderTimeoutError
        ? `${message} It was tried ${stillRunning.attempts} times, one minute apart. Press Try again.`
        : message;
    await writeJob(
      {
        ...stillRunning,
        status: "failed",
        nextAttemptAt: null,
        lastError: finalMessage,
        errorDetails: details,
        finishedAt: new Date().toISOString(),
      },
      { announce: true },
    );
  }
}

/** The small runner seam so tests can drive the queue without a UI. */
export interface JobRunner {
  wake(): Promise<void>;
  stop(): void;
}

async function scheduleNextRetry(timer: { set: (delay: number) => void }): Promise<void> {
  const jobs = await readJobs();
  const waiting = jobs.filter((job) => job.status === "waiting" && job.nextAttemptAt);
  if (waiting.length === 0) return;
  const next = Math.min(...waiting.map((job) => Date.parse(job.nextAttemptAt ?? job.createdAt)));
  timer.set(Math.max(0, next - Date.now()));
}

export function createJobRunner(): JobRunner {
  let currentRun: Promise<void> | null = null;
  let rerun = false;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRetryTimer(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function schedule(delay: number): void {
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void wake();
    }, delay);
  }

  async function processQueue(): Promise<void> {
    while (!stopped) {
      const next = await nextReadyJob();
      if (!next) {
        // A waiting retry may be due in the future, including after a reload.
        // The timer is the only thing that will wake us when that minute comes.
        await scheduleNextRetry({ set: schedule });
        break;
      }
      await runJob(next);
      await scheduleNextRetry({ set: schedule });
    }
  }

  function wake(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (currentRun) {
      rerun = true;
      return currentRun;
    }
    currentRun = (async () => {
      do {
        rerun = false;
        await processQueue();
      } while (rerun && !stopped);
    })().finally(() => {
      currentRun = null;
    });
    return currentRun;
  }

  return {
    wake,
    stop() {
      stopped = true;
      clearRetryTimer();
    },
  };
}

let singleton: JobRunner | null = null;
let wakeCurrent: (() => void) | null = null;

function wakeJobs(): void {
  wakeCurrent?.();
}

/** Start the one runner this page owns. Safe to call more than once. */
export function startJobRunner(): JobRunner {
  if (singleton) return singleton;
  const runner = createJobRunner();
  singleton = runner;
  wakeCurrent = () => {
    void runner.wake();
  };
  void (async () => {
    await recoverInterruptedJobs();
    await pruneFinishedJobs();
    await refreshViews();
    await runner.wake();
  })();
  return runner;
}

export function stopJobRunner(): void {
  singleton?.stop();
  singleton = null;
  wakeCurrent = null;
}

/** Test isolation: stop timers and forget views/listeners. */
export function resetJobRuntimeForTests(): void {
  stopJobRunner();
  views = EMPTY_VIEWS;
  viewSeq += 1;
  subscribers.clear();
  finishedListeners.clear();
}
