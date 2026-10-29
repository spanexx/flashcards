// WHY: The picture and video caps are promises to the learner's device. These
// tests pin the exact boundary and the plain words a refusal uses.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { describe, expect, it } from "vitest";
import {
  BACKUP_WARN_BYTES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
  MEDIA_CAP_REACHED,
  MOBILE_VIDEO_LINK_ONLY,
  TOTAL_MEDIA_MAX_BYTES,
  VIDEO_MAX_BYTES,
  backupSizeWarning,
  fitImage,
  imageBytesProblem,
  imageTypeProblem,
  isTouchFirstMobile,
  mediaCapProblem,
  videoBytesProblem,
  videoTypeProblem,
} from "@/lib/core/media-rules";

describe("image rules", () => {
  it("accepts JPEG, PNG and WebP and refuses the rest", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "IMAGE/JPEG"]) {
      expect(imageTypeProblem(type)).toBeNull();
    }
    expect(imageTypeProblem("image/gif")).toBe("Choose a JPEG, PNG or WebP image.");
    expect(imageTypeProblem("")).toBe("Choose a JPEG, PNG or WebP image.");
  });

  it("keeps the bytes at the cap and refuses one byte over", () => {
    expect(imageBytesProblem(IMAGE_MAX_BYTES)).toBeNull();
    expect(imageBytesProblem(IMAGE_MAX_BYTES + 1)).toContain("larger than 1 MB");
  });

  it("fits a wide picture, a tall picture and a small one", () => {
    expect(fitImage(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitImage(1000, 2000)).toEqual({ width: 800, height: 1600 });
    expect(fitImage(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitImage(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE)).toEqual({ width: 1600, height: 1600 });
  });

  it("returns an empty size when the picture has no usable dimensions", () => {
    expect(fitImage(0, 1200)).toEqual({ width: 0, height: 0 });
    expect(fitImage(Number.NaN, 1200)).toEqual({ width: 0, height: 0 });
  });
});

describe("video rules", () => {
  it("accepts any video type and refuses the rest", () => {
    expect(videoTypeProblem("video/mp4")).toBeNull();
    expect(videoTypeProblem("video/webm")).toBeNull();
    expect(videoTypeProblem("audio/mp4")).toBe("Choose a video file.");
  });

  it("keeps a video at 20 MB and refuses one byte over", () => {
    expect(videoBytesProblem(VIDEO_MAX_BYTES)).toBeNull();
    expect(videoBytesProblem(VIDEO_MAX_BYTES + 1)).toContain("larger than 20 MB");
  });
});

describe("the 300 MB library cap", () => {
  it("allows a file that lands exactly on the cap and refuses one byte over", () => {
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES - 100, 100)).toBeNull();
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES, 1)).toBe(MEDIA_CAP_REACHED);
  });

  it("frees the bytes a replaced file gave back", () => {
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES, 500, 500)).toBeNull();
    expect(mediaCapProblem(TOTAL_MEDIA_MAX_BYTES, 501, 500)).toBe(MEDIA_CAP_REACHED);
  });

  it("warns about a backup above 150 MB and names the one-pack advice", () => {
    expect(backupSizeWarning(BACKUP_WARN_BYTES)).toBeNull();
    expect(backupSizeWarning(BACKUP_WARN_BYTES + 1)).toContain("one pack at a time");
  });
});

describe("touch-first mobile detection", () => {
  it("counts Android, iPhone, iPod and iPad", () => {
    expect(isTouchFirstMobile("Mozilla/5.0 (Linux; Android 14)")).toBe(true);
    expect(isTouchFirstMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(isTouchFirstMobile("Mozilla/5.0 (iPod touch)")).toBe(true);
    expect(isTouchFirstMobile("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe(true);
  });

  it("counts iPadOS, which reports a Macintosh agent", () => {
    expect(isTouchFirstMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isTouchFirstMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });

  it("keeps a touch laptop a computer", () => {
    expect(isTouchFirstMobile("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Touch", 10)).toBe(false);
    expect(isTouchFirstMobile("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)", 10)).toBe(false);
  });

  it("says a video must be linked, not kept", () => {
    expect(MOBILE_VIDEO_LINK_ONLY).toContain("linked");
  });
});
