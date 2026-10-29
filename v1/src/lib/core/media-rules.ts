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

/** The bytes every kept file across the whole library may take together. */
export const TOTAL_MEDIA_MAX_BYTES = 300_000_000;

/**
 * Above this, a full backup is worth a size warning first: building it holds
 * the archive and every blob at once, about twice the kept total.
 */
export const BACKUP_WARN_BYTES = 150_000_000;

/** The refusal a resized image gets when no encoding fits. */
export const IMAGE_TOO_LARGE =
  "That image is still larger than 1 MB after resizing. Choose a smaller one.";

/** The refusal a video gets when its file is too big. */
export const VIDEO_TOO_LARGE = "That video is larger than 20 MB. Choose a smaller one.";

/** The refusal when the whole library's kept media would pass the 300 MB cap. */
export const MEDIA_CAP_REACHED =
  "Kept media is 300 MB across every pack. Link the video instead, or remove a kept file.";

/** The mobile refusal: the file path for a video is closed on a phone or tablet. */
export const MOBILE_VIDEO_LINK_ONLY =
  "On a phone or tablet, a video must be linked, not kept. Paste a YouTube or web address instead.";

/**
 * Why one more kept file is refused by the total cap, or null when it fits.
 * `totalBytes` counts every kept record already on the device; `replacingBytes`
 * is what an overwritten record frees before the new one lands.
 */
export function mediaCapProblem(totalBytes: number, addingBytes: number, replacingBytes = 0): string | null {
  const after = totalBytes - replacingBytes + addingBytes;
  return after > TOTAL_MEDIA_MAX_BYTES ? MEDIA_CAP_REACHED : null;
}

/** The warning a full backup shows before it builds, or null when it is small. */
export function backupSizeWarning(totalBytes: number): string | null {
  if (totalBytes <= BACKUP_WARN_BYTES) return null;
  const mb = Math.round(totalBytes / 1_000_000);
  return `This backup holds about ${mb} MB of kept media and needs roughly twice that in memory while it builds. On a phone or tablet, export one pack at a time.`;
}

/**
 * True on any touch-first mobile browser. The cause is the device class, not
 * the name: iPadOS reports a Macintosh user agent, so Mac plus touch counts;
 * a touch-screen laptop on Windows, macOS or ChromeOS keeps its desktop agent
 * and stays a computer.
 */
export function isTouchFirstMobile(userAgent: string, maxTouchPoints = 0): boolean {
  const ua = userAgent.toLowerCase();
  if (/android|iphone|ipod|ipad/.test(ua)) return true;
  return /macintosh/.test(ua) && maxTouchPoints > 1;
}

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
