"use client";

// WHY: One page owns the two editor tabs. Everything else is pure helpers or
// thin renderers, so the page only wires state, save and navigation.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor. [pack: mode-editor-design]

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client/api";
import { takeModeDraft, saveModeNotice } from "@/lib/browser/mode-editor-handoff";
import type { LearningMode } from "@/lib/shared/types";
import { modeIssueLines, modeSaveRequest } from "@/app/library/mode-studio-utils";
import JsonTree from "@/app/modes/JsonTree";
import MarkdownPreview from "@/app/modes/MarkdownPreview";
import { highlightJson, initialTabFromSearch, mirrorJsonText, modeWithExampleText } from "@/app/modes/mode-editor-utils";

/** The full-page editor for a stored mode or an unsaved AI draft. */
export default function ModeEditorPage() {
  const router = useRouter();
  const search = useSearchParams();
  const id = search.get("id");
  const isDraftParam = search.get("new") === "1";
  const [tab, setTab] = useState<"skill" | "json">(() => initialTabFromSearch(search.toString()));
  const [draft, setDraft] = useState<LearningMode | null>(null);
  const [skillSource, setSkillSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [missing, setMissing] = useState<string | null>(null);
  const skillRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    // WHY: defer state updates outside the effect body; the app uses the same
    // promise pattern in LibraryClient and ModesClient.
    const start = async () => {
      if (isDraftParam) {
        const held = takeModeDraft();
        if (cancelled) return;
        if (!held) setMissing("That draft has expired. Start again from Learning modes.");
        else { setDraft(held); setSkillSource(held.skillInstructions); }
        return;
      }
      if (!id) {
        if (!cancelled) setMissing("Choose a mode to edit from Learning modes.");
        return;
      }
      try {
        const answer = await apiGet<{ modes: LearningMode[] }>("/api/modes");
        if (cancelled) return;
        const found = answer.modes.find((mode) => mode.id === id && !mode.isBuiltIn);
        if (!found) setMissing(`There is no editable mode with the id "${id}".`);
        else { setDraft(found); setSkillSource(found.skillInstructions); }
      } catch (problem: unknown) {
        if (!cancelled) setMissing(problem instanceof Error ? problem.message : "The mode could not be read.");
      }
    };
    const pending = Promise.resolve().then(() => start());
    return () => { cancelled = true; void pending; };
  }, [id, isDraftParam]);

  const chooseTab = (next: "skill" | "json") => {
    setTab(next);
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    router.replace(`/modes/editor?${params.toString()}`);
  };

  // WHY: the JSON tree's skill link must land the learner in the source box,
  // not just on the right tab. The prototype did both. [mode-editor-design]
  const openSkill = () => {
    chooseTab("skill");
    window.requestAnimationFrame(() => skillRef.current?.focus());
  };

  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setIssues([]);
    const gate = modeWithExampleText(draft, JSON.stringify(draft.canonicalExample));
    if (!gate.ok) {
      setIssues([gate.issue]);
      setBusy(false);
      return;
    }
    try {
      const request = modeSaveRequest(gate.mode, isDraftParam);
      const saved = await apiSend<{ mode: LearningMode }>(request.url, request.method, request.body);
      saveModeNotice(`${saved.mode.name} was saved.`);
      router.push("/modes");
    } catch (problem) {
      const lines = modeIssueLines(problem);
      setIssues(lines.length > 0 ? lines : [problem instanceof Error ? problem.message : "Save failed."]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push("/modes");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (missing) {
    return (
      <main className="stack" style={{ padding: 24 }}>
        <div className="notice error">{missing}</div>
        <Link href="/modes" prefetch={false} className="btn ghost">Back to Learning modes</Link>
      </main>
    );
  }
  if (!draft) return <main className="stack" style={{ padding: 24 }}><p className="muted">Opening the mode editor...</p></main>;

  const mirror = mirrorJsonText(draft);
  return (
    <main className="editor-page stack" style={{ gap: 10 }}>
      <div className="editor-head">
        <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
          <span className="editor-crumb">Learning modes / Edit</span>
          <h1>{draft.name}</h1>
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => router.push("/modes")}>Cancel</button>
          <button type="button" className="btn primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving..." : "Save mode"}
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "skill"} className={`tab${tab === "skill" ? " active" : ""}`} onClick={() => chooseTab("skill")}>
          Markdown skill
        </button>
        <button type="button" role="tab" aria-selected={tab === "json"} className={`tab${tab === "json" ? " active" : ""}`} onClick={() => chooseTab("json")}>
          JSON example
        </button>
      </div>

      {issues.length > 0 ? (
        <div className="notice error">
          <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      ) : null}

      <section className="editor-surface">
        {tab === "skill" ? (
          <>
            <div className="editor-pane">
              <div className="cap">Write</div>
              <textarea
                ref={skillRef}
                className="editor-source mono"
                value={skillSource}
                spellCheck={false}
                onChange={(event) => {
                  setSkillSource(event.target.value);
                  setDraft({ ...draft, skillInstructions: event.target.value });
                }}
              />
            </div>
            <div className="editor-pane">
              <div className="cap">Preview</div>
              <div className="editor-preview scroll-area"><MarkdownPreview source={skillSource} /></div>
            </div>
          </>
        ) : (
          <>
            <div className="editor-pane">
              <div className="cap">JSON source</div>
              <pre className="editor-json mono" dangerouslySetInnerHTML={{ __html: highlightJson(mirror) }} />
            </div>
            <div className="editor-pane">
              <div className="cap">Explorer preview</div>
              <JsonTree
                root={draft}
                onChange={(next) => setDraft(next as LearningMode)}
                onOpenSkill={openSkill}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
