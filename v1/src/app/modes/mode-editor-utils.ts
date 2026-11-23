// WHY: The full-page editor keeps its tree edits, previews and save gate in one
// pure module, so the node-only test suite proves them without a renderer.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor. [pack: mode-editor-design]

import { learningModeIssues } from "@/lib/browser/modes";
import type { LearningMode } from "@/lib/shared/types";

/** A path into the mode object. Numbers index arrays; strings name object keys. */
export type TreePath = Array<string | number>;

/** One row the explorer renders. The component holds only expanded state. */
export interface TreeRow {
  path: TreePath;
  parent: TreePath;
  label: string;
  depth: number;
  kind: "branch" | "leaf";
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  value: unknown;
  count?: number;
  autoOpen: boolean;
}

/** Read one value by path. A missing path yields undefined. */
export function getAt(root: unknown, path: TreePath): unknown {
  return path.reduce<unknown>(
    (value, key) => (value == null ? undefined : (value as Record<string | number, unknown>)[key]),
    root,
  );
}

/**
 * Write one value by path without mutating the original.
 * WHY: React state must change identity for a rerender; the tree never edits in place.
 */
export function setAt(root: unknown, path: TreePath, value: unknown): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (Array.isArray(root)) {
    const next = [...root];
    next[Number(key)] = setAt(next[Number(key)], rest, value);
    return next;
  }
  const next = { ...((root ?? {}) as Record<string, unknown>) };
  next[String(key)] = setAt(next[String(key)], rest, value);
  return next;
}

/** Remove one value by path: splice arrays, omit object keys. */
export function deleteAt(root: unknown, path: TreePath): unknown {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getAt(root, parentPath);
  if (Array.isArray(parent)) {
    const next = [...parent];
    next.splice(Number(key), 1);
    return setAt(root, parentPath, next);
  }
  const next = { ...((parent ?? {}) as Record<string, unknown>) };
  delete next[String(key)];
  return setAt(root, parentPath, next);
}

/** Rename an object key in place in key order. Arrays keep their indices. */
export function renameKeyAt(root: unknown, path: TreePath, newKey: string): unknown {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const oldKey = String(path[path.length - 1]);
  const parent = getAt(root, parentPath);
  if (!parent || Array.isArray(parent)) return root;
  const rebuilt: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parent as Record<string, unknown>)) {
    rebuilt[key === oldKey ? newKey : key] = value;
  }
  return setAt(root, parentPath, rebuilt);
}

/**
 * A blank entry for an array: object slots get {}, primitives get their zero.
 * WHY: cloning the first item silently duplicated ids and deck/card content.
 */
export function blankArrayItem(items: unknown[]): unknown {
  const first = items[0];
  if (first !== null && typeof first === "object" && !Array.isArray(first)) return {};
  if (typeof first === "number") return 0;
  if (typeof first === "boolean") return false;
  return "";
}

/** The breadcrumb text for one path. */
export function pathText(path: TreePath): string {
  return path.length ? `mode / ${path.map(String).join(" / ")}` : "mode";
}

/** Escape text before it is used as HTML. */
export function escapeHtml(text: unknown): string {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (char) => entities[char]);
}

/** Colour a pretty JSON string. The source pane mirrors the tree, never edits it. */
export function highlightJson(json: string): string {
  return escapeHtml(json).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str: string | undefined, colon: string | undefined, bool: string | undefined) => {
      let cls = "json-num";
      if (str) cls = colon ? "json-key" : "json-string";
      if (bool) cls = bool === "null" ? "json-null" : "json-bool";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

/** Render the approved Markdown subset with HTML escaped first. */
export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src).split("\n");
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) { html += "</ul>"; inList = false; }
  };
  for (const line of lines) {
    const text = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    const heading = text.match(/^(#{1,3})\s+(.*)$/);
    const bullet = text.match(/^-\s+(.*)$/);
    if (heading) {
      closeList();
      html += `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`;
    } else if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${bullet[1]}</li>`;
    } else if (text.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${text}</p>`;
    }
  }
  closeList();
  return html;
}

/** The derived pretty text shown beside the tree. */
export function mirrorJsonText(root: unknown): string {
  return JSON.stringify(root, null, 2);
}

/** Only the top-level skill text is a link into the Markdown tab. */
export function isSkillInstructionsLink(path: TreePath): boolean {
  return path.length === 1 && path[0] === "skillInstructions";
}

/** Deep-link the reviewed two-tab layout. */
export function initialTabFromSearch(search: string): "skill" | "json" {
  return new URLSearchParams(search).get("tab") === "json" ? "json" : "skill";
}

/** Preorder rows for the recursive explorer. */
export function treeRowsFor(root: unknown): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (value: unknown, path: TreePath, parent: TreePath, depth: number) => {
    const isBranch = value !== null && typeof value === "object";
    const type: TreeRow["type"] = Array.isArray(value)
      ? "array"
      : isBranch
        ? "object"
        : value === null
          ? "null"
          : typeof value as TreeRow["type"];
    rows.push({
      path,
      parent,
      label: path.length ? String(path[path.length - 1]) : "mode",
      depth,
      kind: isBranch ? "branch" : "leaf",
      type,
      value,
      ...(isBranch ? { count: Array.isArray(value) ? value.length : Object.keys(value as object).length } : {}),
      autoOpen: path.length === 0 || pathText(path) === "mode / canonicalExample",
    });
    if (!isBranch) return;
    const entries = Array.isArray(value)
      ? value.map((item, index) => [index, item] as const)
      : Object.entries(value as Record<string, unknown>);
    for (const [key, child] of entries) walk(child, [...path, key], path, depth + 1);
  };
  walk(root, [], [], 0);
  return rows;
}

/** The single parse-and-validate gate shared by this page and the old save path. */
export function modeWithExampleText(
  mode: LearningMode,
  text: string,
): { ok: true; mode: LearningMode } | { ok: false; issue: string } {
  let example: unknown;
  try {
    example = JSON.parse(text);
  } catch {
    return { ok: false, issue: "canonicalExample: this must be JSON" };
  }
  const candidate = { ...mode, canonicalExample: example };
  const issues = learningModeIssues(candidate);
  if (issues.length > 0) {
    return { ok: false, issue: issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ") };
  }
  return { ok: true, mode: candidate };
}
