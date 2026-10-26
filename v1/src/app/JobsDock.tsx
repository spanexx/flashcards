"use client";

// WHY: A learner should see background work from any screen. This quiet control
// owns the visible state, the completion notice and the links back to what the
// job made, while the runner owns the work.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

function focusFrom(job: JobView): void {
  if (!job.result) return;
  focusLibrary({
    packName: job.result.packName,
    deckId: job.result.kind === "cards" ? (job.result.deckId ?? undefined) : undefined,
  });
}

export default function JobsDock() {
  const jobs = useSyncExternalStore(subscribeJobs, getJobsSnapshot, getServerJobsSnapshot);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<JobView[]>([]);

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
                        className="btn small"
                        href={href}
                        prefetch={false}
                        onClick={() => focusFrom(job)}
                      >
                        View
                      </Link>
                    ) : null}
                    <button className="btn small" type="button" onClick={() => dismiss(job.id)}>
                      Dismiss
                    </button>
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
          onClick={() => setOpen((previous) => !previous)}
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
            <button className="btn small" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="jobs-body">
            {jobs.map((job) => {
              const href = jobHref(job);
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
                        <button className="btn small" type="button" onClick={() => retry(job.id)}>
                          Try again
                        </button>
                      ) : null}
                      {href ? (
                        <Link
                          className="btn small"
                          href={href}
                          prefetch={false}
                          onClick={() => {
                            focusFrom(job);
                            setOpen(false);
                          }}
                        >
                          View
                        </Link>
                      ) : null}
                      <button className="btn small" type="button" onClick={() => dismiss(job.id)}>
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
