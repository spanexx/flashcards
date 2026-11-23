"use client";

// WHY: The explorer is the only JSON editor. This component renders rows from
// pure helpers and keeps just two local facts: which branches are open and
// which row was last touched.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor. [pack: mode-editor-design]

import { useState } from "react";
import {
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

/** Recursive, file-explorer-style editor for one JSON object. */
export default function JsonTree({ root, onChange, onOpenSkill }: JsonTreeProps) {
  const rows = treeRowsFor(root);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rows.filter((row) => row.autoOpen).map((row) => pathText(row.path))),
  );
  const [active, setActive] = useState("mode");

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
      const next = [...parent, parent.length ? structuredClone(parent[0]) : ""];
      onChange(setAt(root, row.path, next));
      return;
    }
    const key = window.prompt("Key name", "newKey");
    if (!key) return;
    onChange(setAt(root, row.path, { ...((parent ?? {}) as Record<string, unknown>), [key]: "" }));
    setExpanded((current) => new Set(current).add(pathText(row.path)));
  };

  const remove = (row: TreeRow) => {
    if (!window.confirm(`Remove ${row.label}?`)) return;
    onChange(deleteAt(root, row.path));
  };

  return (
    <div className="json-tree">
      <div className="json-breadcrumb mono" aria-live="polite">{active}</div>
      {visible.map((row) => {
        const isBranch = row.kind === "branch";
        const pathKey = pathText(row.path);
        return (
          <div className="json-tree-row" key={pathKey} style={{ paddingLeft: 6 + row.depth * 16 }}>
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
                ) : (
                  <input
                    className="json-value-input mono"
                    value={typeof row.value === "string" ? row.value : JSON.stringify(row.value)}
                    title={String(row.value)}
                    aria-label={`Value ${row.label}`}
                    onFocus={() => setActive(pathKey)}
                    onChange={(event) => {
                      const next = row.type === "number" ? Number(event.target.value) : event.target.value;
                      onChange(setAt(root, row.path, next));
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
