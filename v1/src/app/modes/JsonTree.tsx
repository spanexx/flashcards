"use client";

// WHY: The explorer is the only JSON editor. This component renders rows from
// pure helpers and keeps just two local facts: which branches are open and
// which row was last touched.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor. [pack: mode-editor-design]

import { Fragment, useState } from "react";
import {
  blankArrayItem,
  deleteAt,
  getAt,
  isSkillInstructionsLink,
  pathText,
  renameKeyAt,
  setAt,
  treeRowsFor,
  type TreePath,
  type TreeRow,
} from "./mode-editor-utils";

interface JsonTreeProps {
  root: unknown;
  onChange: (next: unknown) => void;
  onOpenSkill: () => void;
}

/**
 * A number cell keeps its typed text until blur.
 * WHY: committing on every keystroke turns "-" into NaN and "" into 0.
 */
function NumberCell({ value, label, onFocus, onCommit }: {
  value: number;
  label: string;
  onFocus: () => void;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <input
      className="json-value-input mono"
      value={text}
      aria-label={`Value ${label}`}
      onFocus={onFocus}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      onBlur={() => {
        const parsed = Number(text);
        if (text.trim() !== "" && Number.isFinite(parsed)) onCommit(parsed);
        else setText(String(value));
      }}
    />
  );
}

/** Recursive, file-explorer-style editor for one JSON object. */
export default function JsonTree({ root, onChange, onOpenSkill }: JsonTreeProps) {
  const rows = treeRowsFor(root);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rows.filter((row) => row.autoOpen).map((row) => pathText(row.path))),
  );
  const [active, setActive] = useState("mode");
  // WHY: add and remove stay on the row. Native dialogs broke the app's look
  // and could be blocked by the browser. [mode-editor-design]
  const [addingAt, setAddingAt] = useState<TreePath | null>(null);
  const [newKey, setNewKey] = useState("");
  const [confirming, setConfirming] = useState<TreePath | null>(null);

  const toggle = (path: TreePath) => {
    const key = pathText(path);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visible = rows.filter(
    (row) => row.path.length === 0 || expanded.has(pathText(row.parent)),
  );

  const addChild = (row: TreeRow) => {
    const parent = getAt(root, row.path);
    if (Array.isArray(parent)) {
      // WHY: a new array entry starts blank. Cloning item 0 copied ids and data.
      onChange(setAt(root, row.path, [...parent, blankArrayItem(parent)]));
      return;
    }
    setAddingAt(row.path);
    setNewKey("");
    setConfirming(null);
  };

  const commitNewKey = () => {
    if (!addingAt) return;
    const key = newKey.trim();
    if (key) {
      const parent = (getAt(root, addingAt) ?? {}) as Record<string, unknown>;
      if (!(key in parent)) {
        onChange(setAt(root, addingAt, { ...parent, [key]: "" }));
        setExpanded((current) => new Set(current).add(pathText(addingAt)));
      }
    }
    setAddingAt(null);
    setNewKey("");
  };

  const remove = (row: TreeRow) => {
    setConfirming(row.path);
    setAddingAt(null);
  };

  const confirmRemove = (row: TreeRow) => {
    onChange(deleteAt(root, row.path));
    setConfirming(null);
  };

  return (
    <div className="json-tree">
      <div className="json-breadcrumb mono" aria-live="polite">{active}</div>
      {visible.map((row) => {
        const isBranch = row.kind === "branch";
        const pathKey = pathText(row.path);
        return (
          <Fragment key={pathKey}>
          <div className="json-tree-row" style={{ paddingLeft: 6 + row.depth * 16 }}>
            {isBranch ? (
              <>
                <button
                  type="button"
                  className={`json-chevron${expanded.has(pathKey) ? " open" : ""}`}
                  aria-label={expanded.has(pathKey) ? "Collapse" : "Expand"}
                  onClick={() => toggle(row.path)}
                >
                  ▸
                </button>
                <span className="json-branch-label">{row.label}</span>
                <span className="json-badge mono">{row.count}</span>
                <button type="button" className="json-action" title="Add entry" onClick={() => addChild(row)}>+</button>
                {row.path.length ? (
                  <button type="button" className="json-action danger" title="Remove" onClick={() => remove(row)}>×</button>
                ) : null}
              </>
            ) : (
              <>
                <input
                  className="json-key-input mono"
                  value={row.label}
                  readOnly={row.path.length === 0}
                  aria-label={`Key ${row.label}`}
                  onFocus={() => setActive(pathKey)}
                  onChange={(event) => {
                    const wanted = event.target.value.trim();
                    if (wanted && wanted !== row.label) {
                      onChange(renameKeyAt(root, row.path, wanted));
                      setActive(pathText([...row.path.slice(0, -1), wanted]));
                    }
                  }}
                />
                {isSkillInstructionsLink(row.path) ? (
                  <button
                    type="button"
                    className="json-link mono"
                    title="Edit in the Markdown tab"
                    onFocus={() => setActive(pathKey)}
                    onClick={onOpenSkill}
                  >
                    Open skill editor ↗
                  </button>
                ) : row.type === "boolean" ? (
                  <input
                    type="checkbox"
                    className="json-check"
                    checked={Boolean(row.value)}
                    aria-label={row.label}
                    onFocus={() => setActive(pathKey)}
                    onChange={(event) => onChange(setAt(root, row.path, event.target.checked))}
                  />
                ) : row.type === "number" && typeof row.value === "number" ? (
                  <NumberCell
                    key={String(row.value)}
                    value={row.value}
                    label={row.label}
                    onFocus={() => setActive(pathKey)}
                    onCommit={(next) => onChange(setAt(root, row.path, next))}
                  />
                ) : (
                  <input
                    className="json-value-input mono"
                    value={typeof row.value === "string" ? row.value : JSON.stringify(row.value)}
                    title={String(row.value)}
                    aria-label={`Value ${row.label}`}
                    onFocus={() => setActive(pathKey)}
                    onChange={(event) => onChange(setAt(root, row.path, event.target.value))}
                  />
                )}
              </>
            )}
          </div>
          {addingAt && pathText(addingAt) === pathKey ? (
            <div className="json-inline">
              <input
                autoFocus
                className="json-value-input mono"
                value={newKey}
                placeholder="New key name"
                aria-label="New key name"
                onChange={(event) => setNewKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitNewKey();
                  if (event.key === "Escape") { setAddingAt(null); setNewKey(""); }
                }}
              />
              <button type="button" className="json-inline-btn" onClick={commitNewKey}>Add</button>
              <button type="button" className="json-inline-btn" onClick={() => { setAddingAt(null); setNewKey(""); }}>Cancel</button>
            </div>
          ) : null}
          {confirming && pathText(confirming) === pathKey ? (
            <div className="json-inline json-confirm">
              <span>Remove {row.label}?</span>
              <button type="button" className="json-inline-btn danger" onClick={() => confirmRemove(row)}>Remove</button>
              <button type="button" className="json-inline-btn" onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
