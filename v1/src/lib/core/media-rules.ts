// WHY: The limits belong to the learner's device, not to the Wix editor form.
// Keeping the numbers and the plain refusals in one pure module means the
// picker and the tests agree, and a browser check never invents its own cap.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

/** The longest edge kept for one stored image. */
export const IMAGE_MAX_EDGE = 1600;

/** The bytes one stored image may take after resizing. */
export const IMAGE_MAX_BYTES = 1_000_000;

/** The bytes one stored video may take. */
export const VIDEO_MAX_BYTES = 20_000_000;

/** The refusal a resized image gets when no encoding fits. */
export const IMAGE_TOO_LARGE =
  "That image is still larger than 1 MB after resizing. Choose a smaller one.";

/** The refusal a video gets when its file is too big. */
export const VIDEO_TOO_LARGE = "That video is larger than 20 MB. Choose a smaller one.";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Why an image type is refused, or null when it is one of the three. */
export function imageTypeProblem(type: string): string | null {
  return IMAGE_TYPES.has(type.toLowerCase()) ? null : "Choose a JPEG, PNG or WebP image.";
}

/** Why a resized image is still refused, or null when it fits. */
export function imageBytesProblem(bytes: number): string | null {
  return bytes > IMAGE_MAX_BYTES ? IMAGE_TOO_LARGE : null;
}

/** Why a file is not a video, or null when the browser calls it one. */
export function videoTypeProblem(type: string): string | null {
  return type.toLowerCase().startsWith("video/") ? null : "Choose a video file.";
}

/** Why a video is refused, or null when it fits. */
export function videoBytesProblem(bytes: number): string | null {
  return bytes > VIDEO_MAX_BYTES ? VIDEO_TOO_LARGE : null;
}

/** A size that fits inside the longest edge without changing the shape. */
export interface FittedSize {
  width: number;
  height: number;
}

/** Scale a picture down to the longest edge; small pictures stay as they are. */
export function fitImage(width: number, height: number, maxEdge = IMAGE_MAX_EDGE): FittedSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
