// WHY: The picture and video caps are promises to the learner's device. These
// tests pin the exact boundary and the plain words a refusal uses.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { describe, expect, it } from "vitest";
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
  VIDEO_MAX_BYTES,
  fitImage,
  imageBytesProblem,
  imageTypeProblem,
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
