"use client";

// WHY: A learner picks how the AI should write cards before choosing a method.
// One focused form owns that choice, so Write, Generate and Chat cannot each
// invent a different set of fields.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for the shared New Pack block. [pack: mode-studio-ui]

import type { CreationBrief } from "@/lib/shared/creation";
import { ANSWER_MODES, type AnswerMode, type LearningMode } from "@/lib/shared/types";
import { cardMixForMode } from "./mode-studio-utils";
import LanguageField from "./LanguageField";

interface LearningModeFieldsProps {
  brief: CreationBrief;
  modes: LearningMode[];
  onChange: (patch: Partial<CreationBrief>) => void;
}

/** The shared New Pack fields. Only a pack target renders this block. */
export default function LearningModeFields({ brief, modes, onChange }: LearningModeFieldsProps) {
  const selected = modes.find((mode) => mode.id === brief.modeId) ?? null;
  // WHY: a missing or broken id is silent at prompt time, so the form only
  // shows a label when the id still names a mode the app actually has.
  const selectedLabel = selected?.name ?? "";
  const mix = brief.cardMix ?? cardMixForMode(selected);

  const chooseMode = (id: string) => {
    const mode = modes.find((entry) => entry.id === id) ?? null;
    onChange({ modeId: id || undefined, cardMix: cardMixForMode(mode) });
  };

  const toggleMix = (value: AnswerMode) => {
    const next = mix.includes(value) ? mix.filter((item) => item !== value) : [...mix, value];
    onChange({ cardMix: next });
  };

  return (
    <section className="brief-block">
      <div className="brief-head">
        <div>
          <h3 style={{ margin: 0 }}>How should the AI study this pack?</h3>
          <p className="brief-note" style={{ margin: "4px 0 0" }}>
            These choices feed Generate and Chat. A hand-written pack has no prompt, so no mode is
            stored on it.
          </p>
        </div>
        {selectedLabel ? <span className="pill">{selectedLabel}</span> : null}
      </div>

      <div className="brief-grid">
        <label className="field-label">
          Learning mode
          <select
            className="field"
            value={brief.modeId ?? ""}
            onChange={(event) => chooseMode(event.target.value)}
          >
            <option value="">(no mode selected)</option>
            {modes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Subject
          <input
            className="field"
            value={brief.subject}
            onChange={(event) => onChange({ subject: event.target.value })}
            placeholder="What should the cards teach?"
          />
        </label>
        <LanguageField
          label="Target language"
          value={brief.targetLanguage}
          onChange={(value) => onChange({ targetLanguage: value })}
        />
        <LanguageField
          label="Question language"
          value={brief.sourceLanguage}
          onChange={(value) => onChange({ sourceLanguage: value })}
        />
        <div className="field-label">
          Card mix
          <div className="row" style={{ marginTop: 6 }}>
            {ANSWER_MODES.map((value) => (
              <label key={value} className="pill" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={mix.includes(value)}
                  onChange={() => toggleMix(value)}
                />{" "}
                {value}
              </label>
            ))}
          </div>
          <p className="brief-note" style={{ margin: "6px 0 0" }}>
            Stored, not yet used in prompt wording.
          </p>
        </div>
        <label className="field-label">
          Extra study preferences
          <textarea
            className="field"
            value={brief.modePreferences ?? ""}
            onChange={(event) => onChange({ modePreferences: event.target.value })}
            placeholder="One short line at a time."
          />
        </label>
      </div>
    </section>
  );
}
