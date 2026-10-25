// WHY: A dead YouTube id must become a plain message, not a broken player.
// These pure labels and addresses are the part of that fallback most likely to
// drift, so they are pinned without a browser.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { describe, expect, it } from "vitest";
import type { TeachingPart } from "@/lib/shared/types";
import {
  deckLevelFor,
  layerBarText,
  layerExplanation,
  layerPolicy,
  layerSpeech,
  returnReason,
  validateTeachingPart,
  youtubeEmbedUrl,
  youtubeFallbackLabel,
  youtubeIdFrom,
  youtubeStillIsDead,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/client/layer";
const id = "dQw4w9WgXcQ";

type VideoPart = Extract<TeachingPart, { type: "video" }>;

function video(extra: Partial<VideoPart> = {}): VideoPart {
  return { type: "video", source: "youtube", src: id, ...extra };
}

describe("YouTube addresses", () => {
  it("uses the still for the pre-check", () => {
    expect(youtubeThumbnailUrl(id)).toBe(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  });

  it("embeds through the privacy-friendly host and honours a section", () => {
    const url = youtubeEmbedUrl(id, 12, 30);
    expect(url.startsWith(`https://www.youtube-nocookie.com/embed/${id}?`)).toBe(true);
    expect(url).toContain("start=12");
    expect(url).toContain("end=30");
    expect(url).toContain("rel=0");
    expect(url).toContain("playsinline=1");
  });

  it("embeds without a section when none is given", () => {
    const url = youtubeEmbedUrl(id);
    expect(url).not.toContain("start=");
    expect(url).not.toContain("end=");
  });

  it("opens on YouTube at the start of the section", () => {
    expect(youtubeWatchUrl(id)).toBe(`https://www.youtube.com/watch?v=${id}`);
    expect(youtubeWatchUrl(id, 42)).toBe(`https://www.youtube.com/watch?v=${id}&t=42s`);
  });

  // WHY: YouTube answers a dead id with HTTP 404 whose body is a valid 120x90
  // picture, so an image load alone cannot tell the two apart; only its size can.
  it("calls the placeholder still a dead video", () => {
    expect(youtubeStillIsDead(120, 90)).toBe(true);
    expect(youtubeStillIsDead(480, 360)).toBe(false);
    expect(youtubeStillIsDead(0, 0)).toBe(true);
  });
});

describe("the fallback label", () => {
  it("prefers the search text, then the alt text, then plain words", () => {
    expect(youtubeFallbackLabel(video({ search: "past tense Polish" }))).toBe("past tense Polish");
    expect(youtubeFallbackLabel(video({ alt: "A short lesson" }))).toBe("A short lesson");
    expect(youtubeFallbackLabel(video())).toBe("Open on YouTube");
  });

  it("ignores blank text", () => {
    expect(youtubeFallbackLabel(video({ search: "   ", alt: "A short lesson" }))).toBe("A short lesson");
  });
});

describe("deckLevelFor", () => {
  const packs = [
    {
      name: "browser-dev",
      decks: [
        { id: "basics", level: "beginner" as const },
        { id: "network", level: "intermediate" as const },
        { id: "performance", level: "advanced" as const },
      ],
    },
  ];

  it("reads the level from the card's own deck", () => {
    expect(deckLevelFor({ packName: "browser-dev", deckId: "basics" }, packs)).toBe("beginner");
    expect(deckLevelFor({ packName: "browser-dev", deckId: "performance" }, packs)).toBe("advanced");
  });

  it("falls back to intermediate for a missing pack, deck or placement", () => {
    expect(deckLevelFor({ packName: "browser-dev", deckId: "gone" }, packs)).toBe("intermediate");
    expect(deckLevelFor({ packName: "gone", deckId: "basics" }, packs)).toBe("intermediate");
    expect(deckLevelFor({}, packs)).toBe("intermediate");
    expect(deckLevelFor({ packName: "browser-dev", deckId: "basics" }, [])).toBe("intermediate");
  });
});

describe("layerPolicy", () => {
  it("adds no furniture to a card without a layer", () => {
    expect(layerPolicy("beginner", false)).toEqual({
      hasLayer: false,
      before: "hidden",
      after: "hidden",
      peekAddsReturn: false,
    });
  });

  it("opens for a beginner", () => {
    expect(layerPolicy("beginner", true)).toMatchObject({
      before: "open",
      after: "folded",
      peekAddsReturn: false,
    });
  });

  it("folds with a peek cost for intermediate", () => {
    expect(layerPolicy("intermediate", true)).toMatchObject({
      before: "folded",
      after: "folded",
      peekAddsReturn: true,
    });
  });

  it("holds the layer back until the answer for advanced", () => {
    expect(layerPolicy("advanced", true)).toMatchObject({
      before: "hidden",
      after: "folded",
      peekAddsReturn: false,
    });
  });
});

describe("the return rule", () => {
  it("adds one cold repeat when an intermediate learner peeked, even after a wrong answer", () => {
    expect(returnReason({ level: "intermediate", peeked: true, wrong: false, alreadyReturned: false })).toBe("cold");
    expect(returnReason({ level: "intermediate", peeked: true, wrong: true, alreadyReturned: false })).toBe("cold");
  });

  it("returns a wrong card normally when no help was seen", () => {
    expect(returnReason({ level: "intermediate", peeked: false, wrong: true, alreadyReturned: false })).toBe("wrong");
    expect(returnReason({ level: "beginner", peeked: true, wrong: true, alreadyReturned: false })).toBe("wrong");
    expect(returnReason({ level: "advanced", peeked: true, wrong: true, alreadyReturned: false })).toBe("wrong");
  });

  it("returns nothing after a correct answer or after the one return is used", () => {
    expect(returnReason({ level: "advanced", peeked: false, wrong: false, alreadyReturned: false })).toBeNull();
    expect(returnReason({ level: "intermediate", peeked: true, wrong: true, alreadyReturned: true })).toBeNull();
    expect(returnReason({ level: "beginner", peeked: false, wrong: true, alreadyReturned: true })).toBeNull();
  });
});

describe("layer words", () => {
  it("tells the learner what opening costs at each level", () => {
    expect(layerExplanation("beginner", false)).toContain("Open before the question");
    expect(layerExplanation("intermediate", false)).toContain("adds a repeat");
    expect(layerExplanation("intermediate", true)).toContain("adds nothing");
    expect(layerExplanation("advanced", true)).toContain("no extra card");
    expect(layerBarText("beginner", false)).toContain("adds nothing");
    expect(layerBarText("intermediate", false)).toContain("before you answer");
  });
});

describe("youtubeIdFrom", () => {
  it("takes a bare id and every ordinary watch address", () => {
    expect(youtubeIdFrom(id)).toBe(id);
    expect(youtubeIdFrom(`https://www.youtube.com/watch?v=${id}&t=30s`)).toBe(id);
    expect(youtubeIdFrom(`https://youtu.be/${id}`)).toBe(id);
    expect(youtubeIdFrom(`https://youtube.com/shorts/${id}`)).toBe(id);
    expect(youtubeIdFrom(`https://www.youtube-nocookie.com/embed/${id}?start=2`)).toBe(id);
  });

  it("refuses a link with no usable id and a non-web address", () => {
    expect(youtubeIdFrom("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeIdFrom("https://vimeo.com/12345")).toBeNull();
    expect(youtubeIdFrom("not a link")).toBeNull();
  });
});

describe("validateTeachingPart", () => {
  it("accepts a text part with words and refuses an empty one", () => {
    expect(validateTeachingPart({ type: "text", text: "Kawa to napój." })).toBeNull();
    expect(validateTeachingPart({ type: "text", text: "   " })).toContain("words");
  });

  it("asks a picture for a description and a web address", () => {
    expect(
      validateTeachingPart({ type: "image", source: "web", src: "https://example.test/a.png", alt: "A cup" }),
    ).toBeNull();
    expect(validateTeachingPart({ type: "image", source: "web", src: "https://example.test/a.png", alt: "" })).toContain(
      "description",
    );
    expect(validateTeachingPart({ type: "image", source: "web", src: "a.png", alt: "A cup" })).toContain(
      "http",
    );
    expect(validateTeachingPart({ type: "image", source: "local", src: "media-abc", alt: "A cup" })).toBeNull();
    expect(validateTeachingPart({ type: "image", source: "local", src: "C:/a.png", alt: "A cup" })).toContain(
      "local image",
    );
    expect(validateTeachingPart({ type: "image", source: "builtin", src: "", alt: "A cup" })).toContain(
      "app path",
    );
  });

  it("keeps YouTube ids and their time range honest", () => {
    expect(validateTeachingPart(video())).toBeNull();
    expect(validateTeachingPart(video({ src: id, start: 5, end: 30 }))).toBeNull();
    expect(validateTeachingPart(video({ src: `https://youtu.be/${id}` }))).toContain("11-character");
    expect(validateTeachingPart(video({ start: 2.5 }))).toContain("whole number");
    expect(validateTeachingPart(video({ start: 30, end: 30 }))).toContain("after the start");
  });

  it("allows a plain web video but not a time range on it", () => {
    const web: TeachingPart = { type: "video", source: "web", src: "https://example.test/a.mp4" };
    expect(validateTeachingPart(web)).toBeNull();
    expect(validateTeachingPart({ ...web, start: 4 })).toContain("YouTube");
    expect(validateTeachingPart({ ...web, src: "a.mp4" })).toContain("http");
  });
});

describe("layerSpeech", () => {
  it("reads text parts in order and skips every kind of media", () => {
    const parts: TeachingPart[] = [
      { type: "text", text: "pierwszy", lang: "pl-PL" },
      { type: "image", source: "web", src: "https://example.test/a.png", alt: "A picture" },
      { type: "text", text: "drugi" },
      { type: "video", source: "youtube", src: id },
    ];
    expect(layerSpeech(parts, "pl-PL")).toEqual([
      { text: "pierwszy", lang: "pl-PL" },
      { text: "drugi", lang: "pl-PL" },
    ]);
  });

  it("keeps a part's own language and drops blank text", () => {
    const parts: TeachingPart[] = [
      { type: "text", text: "  hello  ", lang: "en-US" },
      { type: "text", text: "   " },
      { type: "text", text: "cześć" },
    ];
    expect(layerSpeech(parts)).toEqual([
      { text: "hello", lang: "en-US" },
      { text: "cześć", lang: "" },
    ]);
  });
});
