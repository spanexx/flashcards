"use client";

// WHY: A pack owns the language pair, the study instruction and the prompt text
// that every later generation and tutor call uses. The editor keeps those facts
// in one place, next to the pack they belong to, and lets the learner reset the
// prompt text without touching the pair or the instruction.
// PACK: language-prompt-control
// 2026-10-23 opencode: created for the pack editor [pack: language-prompt-control]

import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import type { PackPrompts } from "@/lib/packs/types";
import { defaultPackPrompts } from "@/lib/provider/prompt";
import type { PackStatus } from "@/lib/shared/types";
import { COMMON_LANGUAGES, languagePairLabel } from "@/lib/shared/language";

/** What the editor needs from the Packs panel. */
interface PackEditorProps {
  pack: PackStatus;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

/** The four prompt fields in the order the screen shows them. */
type PromptKey = "generationSystem" | "generationTemplate" | "tutorSystem" | "tutorHint";

/** Read a pack's overrides, or the app defaults when it has none. */
function promptsFrom(pack: PackStatus): PackPrompts {
  return pack.prompts ?? defaultPackPrompts();
}

/** Write the edited fields back into the bundle prompt shape. */
function packPromptsFrom(draft: Record<PromptKey, string>): PackPrompts {
  return {
    generation: {
      system: draft.generationSystem,
      template: draft.generationTemplate,
    },
    tutor: {
      system: draft.tutorSystem,
      hintTemplate: draft.tutorHint,
    },
  };
}

export default function PackEditor({
  pack,
  onSaved,
  onClose,
  onError,
  onNotice,
}: PackEditorProps) {
  const initialPrompts = promptsFrom(pack);
  const [targetLanguage, setTargetLanguage] = useState(pack.language ?? "");
  const [sourceLanguage, setSourceLanguage] = useState(pack.sourceLanguage ?? "");
  const [studyInstruction, setStudyInstruction] = useState(pack.studyInstruction ?? "");
  const [customizing, setCustomizing] = useState(Boolean(pack.prompts));
  const [promptDraft, setPromptDraft] = useState<Record<PromptKey, string>>({
    generationSystem: initialPrompts.generation.system,
    generationTemplate: initialPrompts.generation.template,
    tutorSystem: initialPrompts.tutor?.system ?? defaultPackPrompts().tutor?.system ?? "",
    tutorHint: initialPrompts.tutor?.hintTemplate ?? defaultPackPrompts().tutor?.hintTemplate ?? "",
  });
  const [busy, setBusy] = useState(false);

  const promptEmpty =
    customizing &&
    Object.values(promptDraft).some((value) => value.trim().length === 0);

  const save = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      await apiSend(`/api/packs/${encodeURIComponent(pack.name)}`, "PATCH", {
        targetLanguage,
        sourceLanguage,
        studyInstruction,
        prompts: customizing ? packPromptsFrom(promptDraft) : null,
      });
      await onSaved();
      onNotice(
        customizing
          ? `Saved ${pack.name}. Its prompt text now belongs to this pack.`
          : `Saved ${pack.name}. Its prompt text uses the app defaults.`,
      );
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The pack could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const customize = () => {
    setPromptDraft({
      generationSystem: defaultPackPrompts().generation.system,
      generationTemplate: defaultPackPrompts().generation.template,
      tutorSystem: defaultPackPrompts().tutor?.system ?? "",
      tutorHint: defaultPackPrompts().tutor?.hintTemplate ?? "",
    });
    setCustomizing(true);
  };

  const reset = () => {
    setPromptDraft({
      generationSystem: defaultPackPrompts().generation.system,
      generationTemplate: defaultPackPrompts().generation.template,
      tutorSystem: defaultPackPrompts().tutor?.system ?? "",
      tutorHint: defaultPackPrompts().tutor?.hintTemplate ?? "",
    });
    setCustomizing(false);
  };

  return (
    <section className="brief-block" style={{ marginTop: 10 }}>
      <div className="brief-head">
        <div>
          <strong>Edit {pack.name}</strong>
          <p className="brief-note" style={{ margin: "3px 0 0" }}>
            {languagePairLabel({ language: targetLanguage, sourceLanguage })} · every deck and
            card inherits this pack&apos;s language pair and instruction.
          </p>
        </div>
        <span className="badge">Pack</span>
      </div>

      <div className="brief-grid" style={{ marginTop: 10 }}>
        <label className="field-label">
          Cards teach
          <input
            className="field"
            list={`pack-language-options-${pack.name}`}
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            placeholder="e.g. Polish"
            required
          />
        </label>

        <label className="field-label">
          Questions in
          <input
            className="field"
            list={`pack-language-options-${pack.name}`}
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.target.value)}
            placeholder="e.g. English"
          />
        </label>

        <datalist id={`pack-language-options-${pack.name}`}>
          {COMMON_LANGUAGES.map((language) => (
            <option key={language.code} value={language.name} />
          ))}
        </datalist>

        <label className="field-label brief-wide">
          Study instruction (optional)
          <textarea
            className="field"
            rows={2}
            value={studyInstruction}
            onChange={(event) => setStudyInstruction(event.target.value)}
            placeholder="e.g. Read the English line, then type the full Polish line."
          />
        </label>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        {customizing ? (
          <button className="btn small" type="button" onClick={reset} disabled={busy}>
            Reset to app defaults
          </button>
        ) : (
          <>
            <button className="btn small" type="button" onClick={customize} disabled={busy}>
              Customize prompts
            </button>
            <span className="muted">This pack uses the app&apos;s prompt text.</span>
          </>
        )}
      </div>

      {customizing ? (
        <div className="stack" style={{ marginTop: 10 }}>
          <label className="field-label">
            Generation system prompt
            <textarea
              className="field"
              rows={4}
              value={promptDraft.generationSystem}
              onChange={(event) =>
                setPromptDraft((previous) => ({ ...previous, generationSystem: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Generation template
            <textarea
              className="field"
              rows={8}
              value={promptDraft.generationTemplate}
              onChange={(event) =>
                setPromptDraft((previous) => ({ ...previous, generationTemplate: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Tutor system prompt
            <textarea
              className="field"
              rows={4}
              value={promptDraft.tutorSystem}
              onChange={(event) =>
                setPromptDraft((previous) => ({ ...previous, tutorSystem: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Tutor hint template
            <textarea
              className="field"
              rows={6}
              value={promptDraft.tutorHint}
              onChange={(event) =>
                setPromptDraft((previous) => ({ ...previous, tutorHint: event.target.value }))
              }
            />
          </label>
          <p className="brief-note" style={{ margin: 0 }}>
            Save an override to keep this text with the pack. Export, import and backup carry it.
          </p>
        </div>
      ) : (
        <details style={{ marginTop: 10 }}>
          <summary className="muted">See the app defaults</summary>
          <pre className="code-block">
            {defaultPackPrompts().generation.system}
            {"\n\n"}
            {defaultPackPrompts().generation.template}
            {"\n\n"}
            {defaultPackPrompts().tutor?.system ?? ""}
            {"\n\n"}
            {defaultPackPrompts().tutor?.hintTemplate ?? ""}
          </pre>
        </details>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn primary"
          type="button"
          onClick={() => void save()}
          disabled={busy || targetLanguage.trim().length === 0 || promptEmpty}
        >
          Save pack
        </button>
        <button className="btn" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </section>
  );
}
