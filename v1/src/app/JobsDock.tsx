"use client";

// WHY: A learner should see background work from any screen. This quiet control
// owns the visible state, the completion notice and the links back to what the
// job made, while the runner owns the work. A refused import can be shown to
// the provider once, but only after the learner sees the exact text.
// PACK: background-jobs, import-repair
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]
// 2026-10-27 opencode: added the preview-first import repair and round icon
// actions. [pack: import-repair]

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import {
  dismissJob,
  getJobsSnapshot,
  getServerJobsSnapshot,
  jobHref,
  onJobFinished,
  retryJob,
  subscribeJobs,
  type JobView,
} from "@/lib/browser/jobs";
import { focusLibrary } from "@/lib/client/library-focus";
import { repairClause } from "@/lib/core/json-repair";
import type { ProviderStatus } from "@/lib/shared/types";

interface RepairPreview {
  jobId: string;
  requestId: string;
  prompt: string;
}

type RepairPreparation =
  | { ok: true; requestId: string; prompt: string }
  | { ok: false; message: string };

type RepairAnswer =
  | { ok: true; result: unknown }
  | { ok: false; message: string; details: string[] };

function active(job: JobView): boolean {
  return job.status === "queued" || job.status === "running" || job.status === "waiting";
}

function cardWord(count: number): string {
  return count === 1 ? "card" : "cards";
}

function statusWord(job: JobView): string {
  if (job.status === "queued") return "Queued";
  if (job.status === "running") return "Working";
  if (job.status === "waiting") return "Waiting";
  if (job.status === "succeeded") return "Done";
  return "Failed";
}

function statusClass(job: JobView): string {
  if (job.status === "running" || job.status === "queued") return "run";
  if (job.status === "succeeded") return "good";
  if (job.status === "failed") return "bad";
  return "wait";
}

function resultLine(job: JobView): string {
  const result = job.result;
  if (!result) return "Finished.";
  const noun = cardWord(result.count);
  if (job.kind === "import") {
    const duplicates = result.duplicates > 0 ? ` ${result.duplicates} duplicate(s) were already here.` : "";
    // WHY: A repaired file was changed before it was read, so the sentence says
    // so; a clean import keeps the plain line it always had.
    const repairs = repairClause(result.repairs);
    if (repairs) {
      return `${repairs}, then imported ${result.count} ${noun} into “${result.packName}”.${duplicates}`;
    }
    return `Imported ${result.count} ${noun} into “${result.packName}”.${duplicates}`;
  }
  return `Saved ${result.count} generated ${noun} in “${result.packName}”.`;
}

function statusLine(job: JobView, now: number): string {
  if (job.status === "queued") return "Waiting for the current job to finish.";
  if (job.status === "running") {
    return job.kind === "generation" ? "Asking the provider..." : "Checking the file...";
  }
  if (job.status === "waiting") {
    const next = job.nextAttemptAt ? Date.parse(job.nextAttemptAt) : now;
    const seconds = Math.max(0, Math.ceil((next - now) / 1000));
    const attempt = Math.min(job.attempts + 1, job.maxAttempts);
    return `The provider took too long to answer. Retrying in ${seconds}s (try ${attempt} of ${job.maxAttempts}).`;
  }
  if (job.status === "succeeded") return resultLine(job);
  return job.lastError ?? "The job stopped.";
}

function problemText(problem: unknown): string {
  return problem instanceof Error ? problem.message : "That could not be done.";
}

function focusFrom(job: JobView): void {
  if (!job.result) return;
  focusLibrary({
    packName: job.result.packName,
    deckId: job.result.kind === "cards" ? (job.result.deckId ?? undefined) : undefined,
  });
}

/** A round, label-free control. The label lives in aria-label and title. */
function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="job-icon"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3v6h6" />
      <path d="M3.5 9a9 9 0 1 0 2.2-4.2L3 9" />
    </svg>
  );
}

function FixIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export default function JobsDock() {
  const jobs = useSyncExternalStore(subscribeJobs, getJobsSnapshot, getServerJobsSnapshot);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<JobView[]>([]);
  const [providerReady, setProviderReady] = useState(false);
  const [preview, setPreview] = useState<RepairPreview | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairError, setRepairError] = useState<string | null>(null);

  const activeJobs = useMemo(() => jobs.filter(active), [jobs]);
  const oldestActive = useMemo(
    () => [...activeJobs].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))[0],
    [activeJobs],
  );
  const waiting = activeJobs.some((job) => job.status === "waiting");

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  const readProvider = useCallback(async () => {
    try {
      const answer = await apiGet<{ provider: ProviderStatus }>("/api/settings");
      setProviderReady(answer.provider.configured);
    } catch {
      setProviderReady(false);
    }
  }, []);

  useEffect(() => {
    const mountedAt = Date.now();
    return onJobFinished((job) => {
      const finishedAt = Date.parse(job.finishedAt ?? job.updatedAt);
      if (!Number.isFinite(finishedAt) || finishedAt < mountedAt) return;
      setToasts((previous) => [...previous.filter((entry) => entry.id !== job.id), job].slice(-3));
    });
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts((previous) => previous.slice(1));
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const dismiss = (id: string) => {
    setToasts((previous) => previous.filter((job) => job.id !== id));
    void dismissJob(id).catch(() => undefined);
  };

  const retry = (id: string) => {
    setToasts((previous) => previous.filter((job) => job.id !== id));
    void retryJob(id).catch(() => undefined);
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) void readProvider();
  };

  const openRepair = async (jobId: string) => {
    setRepairError(null);
    setRepairBusy(true);
    try {
      const prepared = await apiSend<RepairPreparation>("/api/import-repair", "POST", { jobId });
      if (!prepared.ok) {
        setRepairError(prepared.message);
        return;
      }
      setPreview({ jobId, requestId: prepared.requestId, prompt: prepared.prompt });
    } catch (problem) {
      setRepairError(problemText(problem));
    } finally {
      setRepairBusy(false);
    }
  };

  const sendRepair = async () => {
    if (!preview) return;
    setRepairError(null);
    setRepairBusy(true);
    try {
      const answer = await apiSend<RepairAnswer>("/api/import-repair/send", "POST", {
        requestId: preview.requestId,
      });
      setPreview(null);
      setOpen(true);
      if (!answer.ok) {
        const details = answer.details.length > 0 ? ` ${answer.details.join(" ")}` : "";
        setRepairError(`${answer.message}${details}`);
      }
    } catch (problem) {
      setRepairError(problemText(problem));
    } finally {
      setRepairBusy(false);
    }
  };

  if (jobs.length === 0 && toasts.length === 0) return null;

  return (
    <>
      {toasts.length > 0 ? (
        <div className="job-toast-stack" aria-live="polite">
          {toasts.map((job) => {
            const href = jobHref(job);
            return (
              <div className={`job-toast ${job.status === "failed" ? "bad" : ""}`} role="status" key={job.id}>
                <span className={`dot ${statusClass(job)}`} />
                <div className="grow">
                  <strong>{job.status === "failed" ? "A job failed" : job.kind === "generation" ? "Generation finished" : "Import finished"}</strong>
                  <div className="small muted">{statusLine(job, now)}</div>
                  <div className="job-actions">
                    {href ? (
                      <Link
                        className="job-icon"
                        href={href}
                        prefetch={false}
                        aria-label="View"
                        title="View"
                        onClick={() => focusFrom(job)}
                      >
                        <ViewIcon />
                      </Link>
                    ) : null}
                    <IconAction label="Dismiss" onClick={() => dismiss(job.id)}>
                      <CloseIcon />
                    </IconAction>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {oldestActive && !open ? (
        <div className="jobs-live" role="status">
          <span className={`dot ${statusClass(oldestActive)}`} />
          <div className="grow">
            <strong>{oldestActive.title}</strong>
            <span className="small muted"> · {statusLine(oldestActive, now)}</span>
          </div>
          <button className="btn small" type="button" onClick={() => setOpen(true)}>
            Open
          </button>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <button
          className="jobs-fab"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="jobs-panel"
          onClick={toggleOpen}
        >
          <span className={`dot ${activeJobs.length > 0 ? "run" : "good"}`} />
          <span>Jobs</span>
          {activeJobs.length > 0 ? <span className="count">{activeJobs.length}</span> : null}
        </button>
      ) : null}

      {open ? (
        <section className="jobs-panel" id="jobs-panel" role="dialog" aria-label="Jobs">
          <div className="jobs-head">
            <strong className="grow">Jobs</strong>
            <span className="pill">{activeJobs.length} working</span>
            <IconAction label="Close" onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconAction>
          </div>
          {repairError ? (
            <p className="jobs-repair-error" role="alert">
              {repairError}
            </p>
          ) : null}
          <div className="jobs-body">
            {jobs.map((job) => {
              const href = jobHref(job);
              const failedImport = job.kind === "import" && job.status === "failed";
              return (
                <article className={`job-row ${active(job) ? "active" : ""}`} key={job.id}>
                  <div className="job-top">
                    <span className={`dot ${statusClass(job)}`} />
                    <div className="grow">
                      <div className="job-title">{job.title}</div>
                      <div className="job-detail">{job.detail}</div>
                    </div>
                    <span className={`job-state ${statusClass(job)}`}>{statusWord(job)}</span>
                  </div>
                  <div className={`job-line ${job.status === "failed" ? "error" : ""}`}>{statusLine(job, now)}</div>
                  {failedImport && !providerReady ? (
                    <p className="job-provider-note">
                      A provider is needed to fix a refused import.{" "}
                      <Link href="/settings" prefetch={false}>
                        Settings
                      </Link>
                    </p>
                  ) : null}
                  {job.status === "failed" && job.errorDetails.length > 0 ? (
                    <details className="job-details">
                      <summary>What needs fixing</summary>
                      <ul>
                        {job.errorDetails.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {job.status !== "running" && job.status !== "waiting" && job.status !== "queued" ? (
                    <div className="job-actions">
                      {job.status === "failed" ? (
                        <IconAction label="Try again" onClick={() => retry(job.id)}>
                          <RetryIcon />
                        </IconAction>
                      ) : null}
                      {failedImport && providerReady ? (
                        <IconAction
                          label="Fix with AI"
                          onClick={() => {
                            if (!repairBusy) void openRepair(job.id);
                          }}
                        >
                          <FixIcon />
                        </IconAction>
                      ) : null}
                      {href ? (
                        <Link
                          className="job-icon"
                          href={href}
                          prefetch={false}
                          aria-label="View"
                          title="View"
                          onClick={() => {
                            focusFrom(job);
                            setOpen(false);
                          }}
                        >
                          <ViewIcon />
                        </Link>
                      ) : null}
                      <IconAction label="Dismiss" onClick={() => dismiss(job.id)}>
                        <CloseIcon />
                      </IconAction>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {preview ? (
        <div className="job-preview-backdrop" role="presentation">
          <section
            className="job-preview"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-preview-title"
          >
            <div className="job-preview-head">
              <h2 id="job-preview-title">Send this to the provider?</h2>
              <IconAction
                label="Close preview"
                onClick={() => {
                  setPreview(null);
                  setRepairError(null);
                }}
              >
                <CloseIcon />
              </IconAction>
            </div>
            <p className="small muted">
              The refused file and the reason it was refused will leave this machine. The answer
              must pass the normal import check before anything is saved.
            </p>
            <pre className="job-preview-text">{preview.prompt}</pre>
            {repairError ? (
              <p className="jobs-repair-error" role="alert">
                {repairError}
              </p>
            ) : null}
            <div className="job-preview-actions">
              <button className="btn" type="button" onClick={() => setPreview(null)} disabled={repairBusy}>
                Cancel
              </button>
              <button className="btn primary" type="button" onClick={() => void sendRepair()} disabled={repairBusy}>
                {repairBusy ? "Sending..." : "Send and repair"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
