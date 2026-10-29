"use client";

// WHY: One editor writes every page, whether it was opened from the reader's
// Edit button or from the Course Builder. It edits a half-typed row, never the
// stored page, and nothing is saved until "Save page" is pressed.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { useCallback, useEffect, useRef, useState } from "react";
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
import { youtubeIdFrom } from "@/lib/client/layer";
import {
  deleteMediaIfUnreferenced,
  deviceIsTouchFirstMobile,
  getMedia,
  storeImageFile,
  storeVideoFile,
  totalMediaBytes,
} from "@/lib/browser/media";
import { isMediaId } from "@/lib/core/media";
import { MOBILE_VIDEO_LINK_ONLY, TOTAL_MEDIA_MAX_BYTES } from "@/lib/core/media-rules";
import { pageIdFor } from "@/lib/core/pages";
import type { DictionaryPage, PageLevel, TeachingPart } from "@/lib/shared/types";

interface PageEditorProps {
  level: PageLevel;
  packName: string;
  deckId?: string;
  cardId?: string;
  /** The card summary, deck name or pack name the page belongs to. */
  fallbackTitle: string;
  page: DictionaryPage | null;
  onSaved: (page: DictionaryPage) => void;
  onCancel: () => void;
  /** Offered only when this page is the learner's copy of a shipped page. */
  onRevert?: () => void;
}

const KIND_LABELS: Record<TeachingRowKind, string> = {
  text: "Text",
  image: "Picture",
  video: "Video",
};

/** A stored size in whole megabytes, with a decimal only while it is small. */
function megabytes(bytes: number): string {
  const value = bytes / 1_000_000;
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

/** The picture fields shared by a cover and an image part. */
function ImageFields({
  row,
  onPatch,
  onFile,
}: {
  row: TeachingRow;
  onPatch: (patch: Partial<TeachingRow>) => void;
  onFile: (file: File) => void;
}) {
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <label className="field-label">
        Where the picture comes from
        <select
          className="field"
          value={row.imageSource}
          onChange={(event) =>
            onPatch({
              imageSource: event.target.value as TeachingRow["imageSource"],
              imageSrc: "",
            })
          }
        >
          <option value="web">A web address · linked</option>
          <option value="local">A file · kept in this browser</option>
        </select>
      </label>

      {row.imageSource === "local" ? (
        <label className="field-label">
          {row.imageSrc ? "Choose another picture" : "Choose a picture (up to 1 MB)"}
          <input
            className="field"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
            }}
          />
        </label>
      ) : (
        <label className="field-label">
          Web address
          <input
            className="field"
            value={row.imageSrc}
            onChange={(event) => onPatch({ imageSrc: event.target.value })}
            placeholder="https://example.com/picture.jpg"
          />
        </label>
      )}

      <label className="field-label">
        Short description (required)
        <input
          className="field"
          value={row.imageAlt}
          onChange={(event) => onPatch({ imageAlt: event.target.value })}
          placeholder="What the picture shows, in one line"
        />
      </label>
    </div>
  );
}

export default function PageEditor({
  level,
  packName,
  deckId,
  cardId,
  fallbackTitle,
  page,
  onSaved,
  onCancel,
  onRevert,
}: PageEditorProps) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [lead, setLead] = useState(page?.lead ?? "");
  const [cover, setCover] = useState<TeachingRow | null>(
    page?.cover ? teachingRowFromPart(page.cover) : null,
  );
  const [rows, setRows] = useState<TeachingRow[]>(() =>
    (page?.parts ?? []).map((part) => teachingRowFromPart(part)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);

  const [draftOpen, setDraftOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [prepared, setPrepared] = useState<{ requestId: string; prompt: string } | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // WHY: Replacing or removing a kept file must free its room against the
  // 300 MB cap. This set remembers the files this editing session touched, and
  // the cleanup below deletes only those (never a file a card still points at).
  const touchedMedia = useRef(new Set<string>());

  const refreshBytes = useCallback(async () => {
    try {
      setBytes(await totalMediaBytes());
    } catch {
      setBytes(null);
    }
  }, []);

  const cleanupTouched = useCallback(async () => {
    const ids = [...touchedMedia.current];
    touchedMedia.current.clear();
    for (const id of ids) {
      try {
        await deleteMediaIfUnreferenced(id);
      } catch {
        // A failed cleanup leaves an orphan; the library sweep can still find it.
      }
    }
    void refreshBytes();
  }, [refreshBytes]);

  const localIdInRow = (row: TeachingRow): string | null => {
    const source = row.kind === "image" ? row.imageSource : row.videoSource;
    const src = row.kind === "image" ? row.imageSrc : row.videoSrc;
    return source === "local" && isMediaId(src) ? src : null;
  };

  /** The bytes a replaced file frees, so the cap judges the net total. */
  const replacingBytesFor = async (id: string | null): Promise<number> => {
    if (!id) return 0;
    try {
      return (await getMedia(id))?.bytes ?? 0;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    // WHY: both facts come from the device, so they are read after mount and
    // land after this commit instead of during it.
    Promise.resolve().then(() => {
      void refreshBytes();
      setMobile(deviceIsTouchFirstMobile());
    });
  }, [refreshBytes]);

  const build = teachingPartsFromRows(rows);
  const shortLevel = level === "pack" ? "the pack" : level === "deck" ? "the deck" : "the card";

  const patchRow = (key: string, patch: Partial<TeachingRow>) => {
    setError(null);
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const moveRow = (position: number, delta: number) => {
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
    setRows((previous) => {
      const removed = previous.find((row) => row.key === key);
      const mediaId = removed ? localIdInRow(removed) : null;
      if (mediaId) touchedMedia.current.add(mediaId);
      return previous.filter((row) => row.key !== key);
    });
  };

  const addRow = (kind: TeachingRowKind) => {
    setRows((previous) => [...previous, blankTeachingRow(kind)]);
  };

  const chooseFile = async (row: TeachingRow, file: File) => {
    setError(null);
    setNotice(null);
    try {
      const replaced = localIdInRow(row);
      const record =
        row.kind === "image"
          ? await storeImageFile(file, undefined, await replacingBytesFor(replaced))
          : await storeVideoFile(file, undefined, await replacingBytesFor(replaced));
      if (replaced) touchedMedia.current.add(replaced);
      touchedMedia.current.add(record.id);
      if (row.kind === "image") {
        patchRow(row.key, { imageSource: "local", imageSrc: record.id });
        setNotice("The picture was resized and kept on this device.");
      } else {
        patchRow(row.key, { videoSource: "local", videoSrc: record.id });
        setNotice("The video was kept on this device.");
      }
      void refreshBytes();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The file could not be stored.");
    }
  };

  const chooseCoverFile = async (file: File) => {
    if (!cover) return;
    setError(null);
    setNotice(null);
    try {
      const replaced =
        cover.imageSource === "local" && isMediaId(cover.imageSrc) ? cover.imageSrc : null;
      const record = await storeImageFile(file, undefined, await replacingBytesFor(replaced));
      if (replaced) touchedMedia.current.add(replaced);
      touchedMedia.current.add(record.id);
      setCover({ ...cover, imageSource: "local", imageSrc: record.id });
      setNotice("The cover was resized and kept on this device.");
      void refreshBytes();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The file could not be stored.");
    }
  };

  const removeCover = () => {
    if (cover) {
      const mediaId = localIdInRow(cover);
      if (mediaId) touchedMedia.current.add(mediaId);
    }
    setCover(null);
  };

  const cancel = async () => {
    await cleanupTouched();
    onCancel();
  };

  const save = async () => {
    setError(null);
    setNotice(null);
    if (!build.ok) {
      setError(build.issues.join(" · "));
      return;
    }
    if (level === "card" && build.parts.length === 0) {
      setError("A card page needs at least one part.");
      return;
    }
    let coverPart: TeachingPart | undefined;
    if (cover) {
      const builtCover = teachingPartFromRow(cover);
      if (!builtCover.ok) {
        setError(`Cover: ${builtCover.message}`);
        return;
      }
      if (builtCover.part.type !== "image") {
        setError("A cover is a picture.");
        return;
      }
      coverPart = builtCover.part;
    }

    const id = pageIdFor(level, packName, deckId, cardId);
    const body: Record<string, unknown> = {
      level,
      packName,
      // Pack and deck pages keep any body a shipped pack carried; only a card
      // page is edited part by part on this screen.
      parts: level === "card" ? build.parts : (page?.parts ?? []),
    };
    if (level !== "pack") body.deckId = deckId;
    if (level === "card") body.cardId = cardId;
    if (title.trim()) body.title = title.trim();
    if (lead.trim()) body.lead = lead.trim();
    if (coverPart) body.cover = coverPart;

    setBusy(true);
    try {
      const answer = await apiSend<{ page: DictionaryPage }>(
        `/api/pages/${encodeURIComponent(id)}`,
        "PATCH",
        body,
      );
      // The page now names the files worth keeping; anything it no longer
      // points at frees its room against the cap.
      await cleanupTouched();
      onSaved(answer.page);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The page could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const openDraft = () => {
    setDraftError(null);
    setPrepared(null);
    setDraftOpen(true);
  };

  const closeDraft = () => {
    if (draftBusy) return;
    setDraftOpen(false);
  };

  const askForPrompt = async () => {
    setDraftBusy(true);
    setDraftError(null);
    try {
      const answer = await apiSend<{ requestId: string; prompt: string }>(
        "/api/pages/draft",
        "POST",
        {
          level,
          packName,
          ...(deckId ? { deckId } : {}),
          ...(cardId ? { cardId } : {}),
          ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
        },
      );
      setPrepared(answer);
    } catch (problem) {
      setDraftError(problem instanceof Error ? problem.message : "The prompt could not be prepared.");
    } finally {
      setDraftBusy(false);
    }
  };

  const sendDraft = async () => {
    if (!prepared) return;
    setDraftBusy(true);
    setDraftError(null);
    try {
      const answer = await apiSend<{
        draft: { title?: string; lead?: string; parts: TeachingPart[] };
      }>("/api/pages/draft/send", "POST", { requestId: prepared.requestId });
      const draft = answer.draft;
      if (draft.title && title.trim().length === 0) setTitle(draft.title);
      if (draft.lead && lead.trim().length === 0) setLead(draft.lead);
      const draftRows = draft.parts.map((part) => teachingRowFromPart(part));
      setRows((previous) => (previous.length === 0 ? draftRows : [...previous, ...draftRows]));
      setNotice("The draft is in the editor. Nothing is saved until you press Save page.");
      setDraftOpen(false);
    } catch (problem) {
      setDraftError(problem instanceof Error ? problem.message : "The draft could not be written.");
    } finally {
      setDraftBusy(false);
    }
  };

  const used = bytes === null ? null : Math.min(100, (bytes / TOTAL_MEDIA_MAX_BYTES) * 100);

  return (
    <section className="card">
      <div className="split-head">
        <div>
          <p className="eyebrow">Page editor · {level}</p>
          <h2 style={{ margin: "2px 0 0" }}>{title.trim() || fallbackTitle}</h2>
        </div>
        <div className="row">
          {page?.learnerEdited && onRevert ? (
            <button
              className="btn small"
              type="button"
              onClick={() => setConfirmRevert(true)}
              disabled={busy || confirmRevert}
            >
              Revert to shipped page
            </button>
          ) : null}
          <button className="btn small" type="button" onClick={() => void cancel()} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>

      {confirmRevert ? (
        <div className="notice" style={{ marginTop: 10 }} role="alert">
          <p style={{ margin: 0 }}>
            Revert this copy? Your edits in this browser are removed, and the shipped page comes
            back the next time the app starts.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn small danger"
              type="button"
              onClick={() => {
                setConfirmRevert(false);
                onRevert?.();
              }}
              disabled={busy}
            >
              Revert my copy
            </button>
            <button
              className="btn small"
              type="button"
              onClick={() => setConfirmRevert(false)}
              disabled={busy}
            >
              Keep my edits
            </button>
          </div>
        </div>
      ) : null}

      <div className="stack" style={{ marginTop: 12 }}>
        <label className="field-label">
          Page title (optional)
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={fallbackTitle}
          />
        </label>

        {level === "pack" || level === "deck" ? (
          <label className="field-label">
            The promise — one sentence under the title
            <textarea
              className="field"
              rows={2}
              value={lead}
              onChange={(event) => setLead(event.target.value)}
              placeholder={`What ${shortLevel} covers, in one sentence`}
            />
          </label>
        ) : null}

        {level === "pack" || level === "deck" ? (
          <div className="card tight">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Cover picture</strong>
              {cover ? (
                <button
                  className="btn small danger"
                  type="button"
                  onClick={removeCover}
                  disabled={busy}
                >
                  Remove
                </button>
              ) : (
                <button
                  className="btn small"
                  type="button"
                  onClick={() => setCover(blankTeachingRow("image"))}
                  disabled={busy}
                >
                  Add cover
                </button>
              )}
            </div>
            {cover ? (
              <>
                <ImageFields
                  row={cover}
                  onPatch={(patch) => setCover((previous) => (previous ? { ...previous, ...patch } : previous))}
                  onFile={(file) => void chooseCoverFile(file)}
                />
                {cover.imageSrc ? (
                  <div style={{ marginTop: 10 }}>
                    <TeachingMedia
                      part={
                        cover.imageSource === "local"
                          ? { type: "image", source: "local", src: cover.imageSrc, alt: cover.imageAlt || "Cover" }
                          : { type: "image", source: "web", src: cover.imageSrc, alt: cover.imageAlt || "Cover" }
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted small" style={{ margin: "6px 0 0" }}>
                A cover leads the page in a band. It can be a file kept here, or a web address.
              </p>
            )}
          </div>
        ) : null}

        {level === "card" ? (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Parts, in reading order</strong>
              <span className="small muted">{rows.length} parts</span>
            </div>

            {rows.length === 0 ? (
              <div className="empty">
                <strong>No parts yet.</strong> Add text, a picture or a video. A card page needs at
                least one part.
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
                          aria-label="Page text"
                        />
                        <label className="field-label">
                          Language for the speaker (optional)
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
                      <ImageFields
                        row={row}
                        onPatch={(patch) => patchRow(row.key, patch)}
                        onFile={(file) => void chooseFile(row, file)}
                      />
                    ) : null}

                    {row.kind === "video" ? (
                      <div className="stack" style={{ marginTop: 8 }}>
                        <label className="field-label">
                          Where the video comes from
                          <select
                            className="field"
                            value={row.videoSource}
                            onChange={(event) =>
                              patchRow(row.key, {
                                videoSource: event.target.value as TeachingRow["videoSource"],
                                videoSrc: "",
                                ...(event.target.value === "youtube" ? {} : { start: "", end: "" }),
                              })
                            }
                          >
                            <option value="youtube">YouTube · linked</option>
                            <option value="web">A web address · linked</option>
                            {mobile ? null : <option value="local">A file · kept in this browser</option>}
                          </select>
                        </label>

                        {row.videoSource === "local" ? (
                          mobile ? (
                            <div className="notice" role="status">
                              {MOBILE_VIDEO_LINK_ONLY}
                            </div>
                          ) : (
                            <label className="field-label">
                              {row.videoSrc
                                ? "Choose another video"
                                : "Choose a video (up to 20 MB)"}
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
                          )
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
                            <p className="muted small" style={{ margin: 0 }}>
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
                      </div>
                    ) : null}

                    {issue ? <div className="notice error">{issue}</div> : null}
                  </div>
                );
              })
            )}

            <div className="row">
              <button className="btn small" type="button" onClick={() => addRow("text")}>
                Add text
              </button>
              <button className="btn small" type="button" onClick={() => addRow("image")}>
                Add picture
              </button>
              <button className="btn small" type="button" onClick={() => addRow("video")}>
                Add video
              </button>
            </div>
          </>
        ) : null}

        <div className="dict-meter-block">
          <p className="muted small" style={{ margin: 0 }}>
            Kept media: {bytes === null ? "reading the size..." : `${megabytes(bytes)} MB of 300 MB`}.
            {mobile
              ? " On a phone or tablet, pictures may be kept and videos must be linked."
              : " A file kept here works offline and travels in a shared pack zip."}
          </p>
          <div className="dict-meter" aria-hidden="true">
            <span style={{ width: `${used ?? 0}%` }} />
          </div>
        </div>

        {error ? (
          <div className="notice error" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="notice" role="status">
            {notice}
          </div>
        ) : null}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <button className="btn" type="button" onClick={openDraft} disabled={busy}>
              Draft with AI
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setPreview((value) => !value)}
              aria-pressed={preview}
            >
              {preview ? "Hide preview" : "Preview"}
            </button>
          </div>
          <button className="btn primary" type="button" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving..." : "Save page"}
          </button>
        </div>

        {preview ? (
          <div className="dict-preview" aria-label="Page preview">
            <p className="eyebrow" style={{ margin: 0 }}>
              Preview · nothing is saved
            </p>
            {title.trim() ? <h2 style={{ margin: "4px 0 0" }}>{title.trim()}</h2> : null}
            {lead.trim() ? <p className="lead">{lead.trim()}</p> : null}
            {cover?.imageSrc ? (
              <TeachingMedia
                part={
                  cover.imageSource === "local"
                    ? { type: "image", source: "local", src: cover.imageSrc, alt: cover.imageAlt || "Cover" }
                    : { type: "image", source: "web", src: cover.imageSrc, alt: cover.imageAlt || "Cover" }
                }
              />
            ) : null}
            {build.ok
              ? build.parts.map((part, index) =>
                  part.type === "text" ? (
                    <p className="dict-text" key={index}>
                      {part.text}
                    </p>
                  ) : (
                    <TeachingMedia key={index} part={part} />
                  ),
                )
              : null}
          </div>
        ) : null}
      </div>

      {draftOpen ? (
        <div
          className="dict-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="Draft the page with the provider"
        >
          <div className="card dict-draft">
            <div className="split-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  Draft with AI · your provider
                </p>
                <h2 style={{ margin: "2px 0 0" }}>{fallbackTitle}</h2>
              </div>
              <button className="btn small" type="button" onClick={closeDraft} disabled={draftBusy}>
                Close
              </button>
            </div>

            {prepared === null ? (
              <div className="stack" style={{ marginTop: 10 }}>
                <label className="field-label">
                  What should this page explain?
                  <textarea
                    className="field"
                    rows={3}
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="Say what the page should cover, in your own words."
                  />
                </label>
                <div className="row">
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => void askForPrompt()}
                    disabled={draftBusy}
                  >
                    {draftBusy ? "Building the prompt..." : "Show the exact prompt"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="stack" style={{ marginTop: 10 }}>
                <p className="muted small" style={{ margin: 0 }}>
                  This is exactly what leaves this device. The answer lands in the editor, and
                  nothing is saved until you press Save page.
                </p>
                <pre className="dict-prompt">{prepared.prompt}</pre>
                <div className="row">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setPrepared(null)}
                    disabled={draftBusy}
                  >
                    Back
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => void sendDraft()}
                    disabled={draftBusy}
                  >
                    {draftBusy ? "Waiting for the provider..." : "Send and draft"}
                  </button>
                </div>
              </div>
            )}

            {draftError ? (
              <div className="notice error" role="alert">
                {draftError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
