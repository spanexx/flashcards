"use client";

// WHY: A teaching layer must stay usable when its picture or video does not.
// This component owns one plain failure message per media kind, so a card never
// shows a broken frame, a dead player or an endless spinner.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/shared/paths";
import { getMedia, mediaUrl } from "@/lib/browser/media";
import {
  youtubeEmbedUrl,
  youtubeFallbackLabel,
  youtubeStillIsDead,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/client/layer";
import type { TeachingPart } from "@/lib/shared/types";

/** WHY: The Dictionary earns a video's trace at eighty percent played, so the
 * one media renderer reports playback instead of each screen watching its own
 * player. [pack: course-dictionary] */
export type MediaProgress = (share: number) => void;

/** A picture part, whatever its source. */
export type TeachingImagePart = Extract<TeachingPart, { type: "image" }>;

/** A video part, whatever its source. */
export type TeachingVideoPart = Extract<TeachingPart, { type: "video" }>;

type MediaPart = TeachingImagePart | TeachingVideoPart;

interface TeachingMediaProps {
  part: MediaPart;
  /** Offered by the missing-file fallback; the editor owns the picker. */
  onChooseAgain?: () => void;
  /** Video parts only: how much has played, from 0 to 1. */
  onProgress?: MediaProgress;
}

/** Report a plain video's played share on every time update. */
function sharePlayed(video: HTMLVideoElement): number | null {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return null;
  return Math.min(1, video.currentTime / video.duration);
}

type LocalState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "missing" }
  | { status: "failed" };

/** How long a YouTube still may take before the player is called dead. */
const YOUTUBE_CHECK_MS = 6_000;

/** Load one local Blob and own its object URL until the part closes. */
function useLocalMedia(id: string, kind: "image" | "video"): LocalState {
  const key = `${kind}:${id}`;
  const [loaded, setLoaded] = useState<{ key: string; state: LocalState }>({
    key,
    state: { status: "loading" },
  });
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    getMedia(id)
      .then((record) => {
        if (!active) return;
        if (!record || record.kind !== kind) {
          setLoaded({ key, state: { status: "missing" } });
          return;
        }
        url = mediaUrl(record);
        setLoaded({ key, state: { status: "ready", url } });
      })
      .catch(() => {
        if (active) setLoaded({ key, state: { status: "failed" } });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, key, kind]);
  return loaded.key === key ? loaded.state : { status: "loading" };
}

/** One plain message, never a broken frame. */
function Failure({
  message,
  href,
  linkText,
  onChooseAgain,
}: {
  message: string;
  href?: string;
  linkText?: string;
  onChooseAgain?: () => void;
}) {
  return (
    <div className="notice" role="status">
      <p style={{ margin: 0 }}>{message}</p>
      {href || onChooseAgain ? (
        <div className="row" style={{ marginTop: 8 }}>
          {href ? (
            <a className="btn small" href={href} target="_blank" rel="noreferrer noopener">
              {linkText ?? "Open it"}
            </a>
          ) : null}
          {onChooseAgain ? (
            <button className="btn small" type="button" onClick={onChooseAgain}>
              Choose the file again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A picture or video kept in this browser. */
function LocalMedia({
  part,
  onChooseAgain,
  onProgress,
}: {
  part: MediaPart;
  onChooseAgain?: () => void;
  onProgress?: MediaProgress;
}) {
  const [broken, setBroken] = useState(false);
  const state = useLocalMedia(part.src, part.type);

  if (state.status === "loading") return <p className="muted">Loading the file...</p>;

  if (state.status === "missing" || state.status === "failed" || broken) {
    const message =
      state.status === "missing"
        ? "This file is not on this device."
        : "This file could not be shown.";
    return <Failure message={message} onChooseAgain={onChooseAgain} />;
  }

  if (part.type === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        className="teaching-media"
        src={state.url}
        alt={part.alt}
        onError={() => setBroken(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <video
      className="teaching-video"
      src={state.url}
      controls
      preload="metadata"
      onError={() => setBroken(true)}
      onTimeUpdate={
        onProgress
          ? (event) => {
              const share = sharePlayed(event.currentTarget);
              if (share !== null) onProgress(share);
            }
          : undefined
      }
    />
  );
}

/** A built-in or web picture; a failure keeps the alt text and a way out. */
function RemoteImage({ part }: { part: TeachingImagePart }) {
  const [failed, setFailed] = useState(false);
  const src = part.source === "builtin" ? withBasePath(part.src) : part.src;
  if (failed) return <Failure message={part.alt} href={src} linkText="Open the image" />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className="teaching-media"
      src={src}
      alt={part.alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** A web video, with the same plain fallback as a web picture. */
function RemoteVideo({ part, onProgress }: { part: TeachingVideoPart; onProgress?: MediaProgress }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Failure message="This video could not load." href={part.src} linkText="Open the video" />;
  return (
    <video
      className="teaching-video"
      src={part.src}
      controls
      preload="metadata"
      onError={() => setFailed(true)}
      onTimeUpdate={
        onProgress
          ? (event) => {
              const share = sharePlayed(event.currentTarget);
              if (share !== null) onProgress(share);
            }
          : undefined
      }
    />
  );
}

/** A YouTube video is checked by its still before any player is shown. */
function YouTubeVideo({ part, onProgress }: { part: TeachingVideoPart; onProgress?: MediaProgress }) {
  const [probe, setProbe] = useState<{ id: string; state: "ready" | "dead" } | null>(null);
  const state = probe?.id === part.src ? probe.state : "checking";
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // WHY: The player reports its own position over the IFrame API. That is the
  // only honest way to know a linked video reached eighty percent. The effect
  // waits for the ready probe: before it, no iframe exists to listen to.
  useEffect(() => {
    if (!onProgress || state !== "ready") return;
    const frame = frameRef.current;
    if (!frame) return;
    const listen = () => {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: "dictionary", channel: "widget" }),
        "*",
      );
    };
    const timer = setInterval(listen, 1000);
    listen();
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const record = data as { event?: string; info?: { currentTime?: number; duration?: number } };
      if (record.event !== "infoDelivery") return;
      const duration = record.info?.duration ?? 0;
      const current = record.info?.currentTime ?? 0;
      if (duration > 0) onProgress(Math.min(1, current / duration));
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [onProgress, state]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setProbe({ id: part.src, state: "dead" });
    }, YOUTUBE_CHECK_MS);
    const still = new Image();
    const settle = (next: "ready" | "dead") => {
      if (!active) return;
      clearTimeout(timer);
      setProbe({ id: part.src, state: next });
    };
    still.onload = () =>
      settle(youtubeStillIsDead(still.naturalWidth, still.naturalHeight) ? "dead" : "ready");
    still.onerror = () => settle("dead");
    still.src = youtubeThumbnailUrl(part.src);
    return () => {
      active = false;
      clearTimeout(timer);
      still.onload = null;
      still.onerror = null;
    };
  }, [part.src]);

  if (state === "checking") return <p className="muted">Checking the video...</p>;
  if (state === "dead") {
    return (
      <Failure
        message={youtubeFallbackLabel(part)}
        href={youtubeWatchUrl(part.src, part.start)}
        linkText="Open on YouTube"
      />
    );
  }
  const embed = youtubeEmbedUrl(part.src, part.start, part.end);
  return (
    <iframe
      ref={frameRef}
      className="teaching-video"
      src={onProgress ? `${embed}&enablejsapi=1` : embed}
      title={part.alt ?? part.search ?? "Teaching video"}
      allow="encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      // WHY: YouTube rejects an embed whose request carries no Referer with
      // player error 153, so the page sends its origin instead; the origin
      // alone still hides the page path from the video host.
      // PACK: D-41
      // 2026-10-29 qoder: replaced no-referrer after every embed failed. [pack: teaching-layers]
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

/** Render one teaching image or video, whatever its source. */
export default function TeachingMedia({ part, onChooseAgain, onProgress }: TeachingMediaProps) {
  if (part.source === "local") {
    return <LocalMedia part={part} onChooseAgain={onChooseAgain} onProgress={onProgress} />;
  }
  if (part.type === "image") return <RemoteImage part={part} />;
  if (part.source === "youtube") return <YouTubeVideo part={part} onProgress={onProgress} />;
  return <RemoteVideo part={part} onProgress={onProgress} />;
}
