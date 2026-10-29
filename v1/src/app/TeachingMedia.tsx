"use client";

// WHY: A teaching layer must stay usable when its picture or video does not.
// This component owns one plain failure message per media kind, so a card never
// shows a broken frame, a dead player or an endless spinner.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { useEffect, useState } from "react";
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

/** A picture part, whatever its source. */
export type TeachingImagePart = Extract<TeachingPart, { type: "image" }>;

/** A video part, whatever its source. */
export type TeachingVideoPart = Extract<TeachingPart, { type: "video" }>;

type MediaPart = TeachingImagePart | TeachingVideoPart;

interface TeachingMediaProps {
  part: MediaPart;
  /** Offered by the missing-file fallback; the editor owns the picker. */
  onChooseAgain?: () => void;
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
function LocalMedia({ part, onChooseAgain }: { part: MediaPart; onChooseAgain?: () => void }) {
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
function RemoteVideo({ part }: { part: TeachingVideoPart }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Failure message="This video could not load." href={part.src} linkText="Open the video" />;
  return <video className="teaching-video" src={part.src} controls preload="metadata" onError={() => setFailed(true)} />;
}

/** A YouTube video is checked by its still before any player is shown. */
function YouTubeVideo({ part }: { part: TeachingVideoPart }) {
  const [probe, setProbe] = useState<{ id: string; state: "ready" | "dead" } | null>(null);
  const state = probe?.id === part.src ? probe.state : "checking";
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
  return (
    <iframe
      className="teaching-video"
      src={youtubeEmbedUrl(part.src, part.start, part.end)}
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
export default function TeachingMedia({ part, onChooseAgain }: TeachingMediaProps) {
  if (part.source === "local") return <LocalMedia part={part} onChooseAgain={onChooseAgain} />;
  if (part.type === "image") return <RemoteImage part={part} />;
  if (part.source === "youtube") return <YouTubeVideo part={part} />;
  return <RemoteVideo part={part} />;
}
