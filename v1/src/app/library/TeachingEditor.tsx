"use client";

// WHY: A teaching layer is help, not a side of the card. This wizard edits only
// the layer, in three short steps, and saves it on the same card so the record
// never splits just because the help changed.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the three-step teaching editor [pack: teaching-layers]

import { useState } from "react";
import TeachingMedia from "@/app/TeachingMedia";
import { apiSend } from "@/lib/client/api";
import {
  blankTeachingRow,
  teachingPartFromRow,
  teachingPartsFromRows,
  teachingRowFromPart,
  type TeachingRow,
  type TeachingRowKind,
} from "@/lib/client/teaching-editor";
import { storeImageFile, storeVideoFile } from "@/lib/browser/media";
import { youtubeIdFrom } from "@/lib/client/layer";
import type { Card } from "@/lib/shared/types";
import { plainText } from "./library-utils";

/** What the wizard needs from the Cards panel. */
interface TeachingEditorProps {
  card: Card;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

const STEP_LABELS = ["The card", "Teaching parts", "Preview"];

/** One small choice the learner can add. */
const KIND_LABELS: Record<TeachingRowKind, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
};

export default function TeachingEditor({
  card,
  onSaved,
  onClose,
  onError,
  onNotice,
}: TeachingEditorProps) {
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<TeachingRow[]>(() =>
    (card.teaching ?? []).map((part) => teachingRowFromPart(part)),
  );
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const build = teachingPartsFromRows(rows);

  const patchRow = (key: string, patch: Partial<TeachingRow>) => {
    setAttempted(false);
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const moveRow = (position: number, delta: number) => {
    setAttempted(false);
    setRows((previous) => {
      const target = position + delta;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      const [row] = next.splice(position, 1);
      next.splice(target, 0, row);
      return next;
    });
  };

  const removeRow = (key: string) => {
    setRows((previous) => previous.filter((row) => row.key !== key));
  };

  const addRow = (kind: TeachingRowKind) => {
    setRows((previous) => [...previous, blankTeachingRow(kind)]);
  };

  /** Store one chosen picture or video and point the row at it. */
  const chooseFile = async (row: TeachingRow, file: File) => {
    onError(null);
    try {
      if (row.kind === "image") {
        const record = await storeImageFile(file);
        patchRow(row.key, { imageSource: "local", imageSrc: record.id });
        onNotice("The image was resized and stored on this device.");
      } else {
        const record = await storeVideoFile(file);
        patchRow(row.key, { videoSource: "local", videoSrc: record.id });
        onNotice("The video was stored on this device.");
      }
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The file could not be stored.");
    }
  };

  const reviewParts = () => {
    setAttempted(true);
    if (build.ok) setStep(2);
  };

  const save = async () => {
    setAttempted(true);
    if (!build.ok) {
      onError(build.issues[0] ?? "The teaching layer needs fixing.");
      onNotice(build.issues.join(" · "));
      return;
    }
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      await apiSend(`/api/cards/${encodeURIComponent(card.id)}/teaching`, "PATCH", {
        teaching: build.parts.length > 0 ? build.parts : null,
      });
      await onSaved();
      onNotice(
        build.parts.length > 0
          ? "The teaching layer was saved on the same card. Its record stays."
          : "The teaching layer was removed from the card.",
      );
      onClose();
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The teaching layer could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card tight" style={{ marginTop: 10 }}>
      <div className="split-head">
        <div>
          <strong>Teaching layer: {card.summary}</strong>
          <p className="muted" style={{ margin: "3px 0 0" }}>
            Step {step + 1} of 3 · {STEP_LABELS[step]}
          </p>
        </div>
        <button className="btn small" type="button" onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>

      {step === 0 ? (
        <div className="stack" style={{ marginTop: 10 }}>
          <div>
            <div className="muted">Question</div>
            <p style={{ margin: 0 }}>{plainText(card.prompt)}</p>
          </div>
          <div>
            <div className="muted">Answer</div>
            <p style={{ margin: 0 }}>{plainText(card.answer)}</p>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            This editor only changes the help that goes with the card. To change the
            question or answer, use Edit: that makes a new card and copies this layer.
          </p>
          <div className="row">
            <button className="btn primary" type="button" onClick={() => setStep(1)}>
              Next: teaching parts
            </button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="muted" style={{ margin: 0 }}>
            Parts are shown and listened to in this order. They never change the
            question or the answer.
          </p>

          {rows.length === 0 ? (
            <div className="empty">
              <strong>No parts yet.</strong> Add text, an image or a video, or keep the
              card without a layer.
            </div>
          ) : (
            rows.map((row, position) => {
              const built = teachingPartFromRow(row);
              const issue = built.ok ? null : built.message;
              return (
                <div className="card tight" key={row.key}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>
                      {position + 1}. {KIND_LABELS[row.kind]}
                    </strong>
                    <div className="row">
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => moveRow(position, -1)}
                        disabled={position === 0}
                        aria-label="Move this part up"
                      >
                        Up
                      </button>
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => moveRow(position, 1)}
                        disabled={position === rows.length - 1}
                        aria-label="Move this part down"
                      >
                        Down
                      </button>
                      <button
                        className="btn small danger"
                        type="button"
                        onClick={() => removeRow(row.key)}
                        aria-label="Remove this part"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {row.kind === "text" ? (
                    <div className="stack" style={{ marginTop: 8 }}>
                      <textarea
                        className="field"
                        rows={3}
                        value={row.text}
                        onChange={(event) => patchRow(row.key, { text: event.target.value })}
                        placeholder="A short explanation in plain words"
                        aria-label="Teaching text"
                      />
                      <label className="field-label">
                        Language for Listen (optional)
                        <input
                          className="field"
                          value={row.lang}
                          onChange={(event) => patchRow(row.key, { lang: event.target.value })}
                          placeholder="e.g. pl"
                        />
                      </label>
                    </div>
                  ) : null}

                  {row.kind === "image" ? (
                    <div className="stack" style={{ marginTop: 8 }}>
                      <label className="field-label">
                        Where the picture comes from
                        <select
                          className="field"
                          value={row.imageSource}
                          onChange={(event) => {
                            const source = event.target.value as TeachingRow["imageSource"];
                            patchRow(row.key, {
                              imageSource: source,
                              imageSrc:
                                source === "builtin" ? row.imageBuiltinSrc : "",
                            });
                          }}
                        >
                          {row.imageBuiltinSrc.length > 0 ? (
                            <option value="builtin">Pack picture (kept)</option>
                          ) : null}
                          <option value="web">Web address</option>
                          <option value="local">Local file</option>
                        </select>
                      </label>

                      {row.imageSource === "local" ? (
                        <label className="field-label">
                          Choose a picture
                          <input
                            className="field"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void chooseFile(row, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      ) : row.imageSource === "builtin" ? (
                        <p className="muted" style={{ margin: 0 }}>
                          This picture belongs to the pack. Keep it, or replace it with a
                          web address or a local file.
                        </p>
                      ) : (
                        <label className="field-label">
                          Web address
                          <input
                            className="field"
                            value={row.imageSrc}
                            onChange={(event) => patchRow(row.key, { imageSrc: event.target.value })}
                            placeholder="https://example.com/picture.jpg"
                          />
                        </label>
                      )}

                      <label className="field-label">
                        Short description (required)
                        <input
                          className="field"
                          value={row.imageAlt}
                          onChange={(event) => patchRow(row.key, { imageAlt: event.target.value })}
                          placeholder="What the picture shows, in one line"
                        />
                      </label>
                    </div>
                  ) : null}

                  {row.kind === "video" ? (
                    <div className="stack" style={{ marginTop: 8 }}>
                      <label className="field-label">
                        Where the video comes from
                        <select
                          className="field"
                          value={row.videoSource}
                          onChange={(event) => {
                            const source = event.target.value as TeachingRow["videoSource"];
                            patchRow(row.key, {
                              videoSource: source,
                              videoSrc: "",
                              ...(source === "youtube" ? {} : { start: "", end: "" }),
                            });
                          }}
                        >
                          <option value="youtube">YouTube</option>
                          <option value="web">Web address</option>
                          <option value="local">Local file</option>
                        </select>
                      </label>

                      {row.videoSource === "local" ? (
                        <label className="field-label">
                          Choose a video (up to 20 MB)
                          <input
                            className="field"
                            type="file"
                            accept="video/mp4,video/webm,video/ogg"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void chooseFile(row, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      ) : (
                        <label className="field-label">
                          {row.videoSource === "youtube" ? "YouTube link or id" : "Web address"}
                          <input
                            className="field"
                            value={row.videoSrc}
                            onChange={(event) => patchRow(row.key, { videoSrc: event.target.value })}
                            placeholder={
                              row.videoSource === "youtube"
                                ? "https://www.youtube.com/watch?v=..."
                                : "https://example.com/video.mp4"
                            }
                          />
                        </label>
                      )}

                      {row.videoSource === "youtube" ? (
                        <>
                          <p className="muted" style={{ margin: 0 }}>
                            {youtubeIdFrom(row.videoSrc)
                              ? `Video id: ${youtubeIdFrom(row.videoSrc)}`
                              : "Paste a YouTube link or the 11-character id."}
                          </p>
                          <div className="row">
                            <label className="field-label">
                              Start (seconds, optional)
                              <input
                                className="field"
                                inputMode="numeric"
                                value={row.start}
                                onChange={(event) => patchRow(row.key, { start: event.target.value })}
                                placeholder="0"
                              />
                            </label>
                            <label className="field-label">
                              End (seconds, optional)
                              <input
                                className="field"
                                inputMode="numeric"
                                value={row.end}
                                onChange={(event) => patchRow(row.key, { end: event.target.value })}
                                placeholder=""
                              />
                            </label>
                          </div>
                        </>
                      ) : null}

                      {row.videoSource === "youtube" ? (
                        <label className="field-label">
                          Search text (shown if the video cannot play)
                          <input
                            className="field"
                            value={row.search}
                            onChange={(event) => patchRow(row.key, { search: event.target.value })}
                            placeholder="What to search for instead"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  {attempted && issue ? <div className="notice error">{issue}</div> : null}
                </div>
              );
            })
          )}

          <div className="row">
            <button className="btn small" type="button" onClick={() => addRow("text")}>
              Add text
            </button>
            <button className="btn small" type="button" onClick={() => addRow("image")}>
              Add image
            </button>
            <button className="btn small" type="button" onClick={() => addRow("video")}>
              Add video
            </button>
          </div>

          <div className="row">
            <button className="btn" type="button" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn primary" type="button" onClick={reviewParts}>
              Next: preview
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="stack" style={{ marginTop: 10 }}>
          {!build.ok ? (
            <div className="notice error">{build.issues.join(" · ")}</div>
          ) : build.parts.length > 0 ? (
            build.parts.map((part, position) =>
              part.type === "text" ? (
                <p className="layer-text" key={position}>
                  {part.text}
                </p>
              ) : (
                <TeachingMedia key={position} part={part} />
              ),
            )
          ) : (
            <div className="empty">
              <strong>No teaching layer.</strong> Saving now removes it from the card.
            </div>
          )}

          <div className="row">
            <button className="btn" type="button" onClick={() => setStep(1)} disabled={busy}>
              Back
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => void save()}
              disabled={busy || !build.ok}
            >
              {busy
                ? "Saving…"
                : !build.ok
                  ? "Fix the parts first"
                  : build.parts.length > 0
                    ? "Save the layer"
                    : "Remove the layer"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
