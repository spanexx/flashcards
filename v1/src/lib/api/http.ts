// WHY: Every route answers in the same shape, so the browser has one error
// path and one success path. Errors are plain sentences a person can act on.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { NextResponse } from "next/server";

/** A successful answer. */
export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** A plain failure. The browser shows the message without rewriting it. */
export function jsonError(message: string, status = 400, detail?: unknown): NextResponse {
  return NextResponse.json({ error: message, detail }, { status });
}

/** Read a JSON body without throwing on malformed input. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

/** Treat an unknown value as a record when it is one. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Read a required string, trimmed. */
export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Read a number with a fallback, clamped to sane bounds. */
export function asNumber(value: unknown, fallback: number, min = 0, max = 86400000): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Read a string list. */
export function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string") ? (value as string[]) : null;
}
