// WHY: Generate and Chat must ask the same question about what to learn. One
// focused form keeps the subject, focus, style and optional names identical in
// both methods while CreatePanel only owns where the answer goes.
// PACK: creation-control
// 2026-10-22 opencode: created for the creation brief [pack: creation-control]

import type { PackStatus } from "@/lib/shared/types";
import type { CardStyle, CreationBrief, SubjectMode } from "@/lib/shared/creation";
import { COMMON_LANGUAGES, languagePairLabel } from "@/lib/shared/language";
import type { CreateTarget } from "./library-utils";

/** One label and one plain sentence for each style the learner may request. */
const STYLE_OPTIONS: Array<{ value: CardStyle; label: string; note: string }> = [
  {
    value: "mixed",
    label: "Mixed — the AI varies the exercise",
    note: "A mix of fill-the-blank, typing and listening.",
  },
  {
    value: "cloze",
    label: "Fill the blank",
    note: "Hide one word inside a full line.",
  },
  {
    value: "type",
    label: "Type the answer",
    note: "Show a translation and ask for the full line.",
  },
  {
    value: "hear_type",
    label: "Listen and type",
    note: "Speak the full line and ask the learner to type it.",
  },
];

/** What the two subject modes mean in the learner's words. */
const MODE_OPTIONS: Array<{ value: SubjectMode; label: string }> = [
  { value: "learner", label: "I choose" },
  { value: "provider", label: "AI chooses" },
];

/** The fields Generate and Chat share. Write and Import never render this. */
interface CreationBriefFieldsProps {
  target: CreateTarget;
  brief: CreationBrief;
  packs: PackStatus[];
  onChange: (patch: Partial<CreationBrief>) => void;
}

export default function CreationBriefFields({
  target,
  brief,
  packs,
  onChange,
}: CreationBriefFieldsProps) {
  const providerChooses = brief.subjectMode === "provider";
  const hasReadablePack = packs.some((pack) => !pack.error);
  const style = STYLE_OPTIONS.find((option) => option.value === brief.cardStyle) ?? STYLE_OPTIONS[0];
  const focusLabel = target === "cards" ? "Card focus" : "Deck focus";
  const pairLocked = target !== "pack";

  return (
    <section className="brief-block">
      <div className="brief-head">
        <div>
          <strong>What should the cards teach?</strong>
          <p className="brief-note" style={{ margin: "3px 0 0" }}>
            Your subject, focus and card style reach Generate and Chat. Names stay optional.
          </p>
        </div>
        <span className="badge">Your brief</span>
      </div>

      <div className="field-label brief-wide" style={{ marginTop: 10 }}>
        <span>Who chooses what to learn?</span>
        <div className="segmented" role="group" aria-label="Who chooses what to learn">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className="segmented-choice"
              type="button"
              aria-pressed={brief.subjectMode === option.value}
              onClick={() => onChange({ subjectMode: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="brief-grid" style={{ marginTop: 10 }}>
        <label className="field-label brief-wide">
          Subject
          <input
            className="field"
            value={brief.subject}
            onChange={(event) => onChange({ subject: event.target.value })}
            placeholder={
              providerChooses
                ? "The AI will choose from your packs and decks"
                : "e.g. ordering coffee and asking for the bill"
            }
            disabled={providerChooses}
          />
        </label>

        {providerChooses ? (
          <p className="brief-note brief-wide" style={{ margin: 0 }}>
            {hasReadablePack
              ? "The prompt lists your pack names, descriptions and deck labels, then asks for a useful gap. Card text is never sent."
              : "Your library is empty, so the AI will choose a useful subject for a new pack."}
          </p>
        ) : brief.subject.trim().length === 0 ? (
          <p className="brief-note brief-wide" style={{ margin: 0 }}>
            Write what you want to learn before preparing a prompt.
          </p>
        ) : null}

        <label className="field-label">
          {focusLabel} (optional)
          <input
            className="field"
            value={brief.deckFocus}
            onChange={(event) => onChange({ deckFocus: event.target.value })}
            placeholder={target === "cards" ? "e.g. payments, directions" : "e.g. drinks, paying"}
          />
        </label>

        <label className="field-label">
          Card style
          <select
            className="field"
            value={brief.cardStyle}
            onChange={(event) => onChange({ cardStyle: event.target.value as CardStyle })}
          >
            {STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="brief-note brief-wide" style={{ margin: 0 }}>
          {style.note}
        </p>

        <label className="field-label">
          Cards teach
          <input
            className="field"
            list="creation-language-options"
            value={brief.targetLanguage}
            onChange={(event) => onChange({ targetLanguage: event.target.value })}
            placeholder="e.g. Polish"
            disabled={pairLocked}
            required
          />
        </label>

        <label className="field-label">
          Questions in
          <input
            className="field"
            list="creation-language-options"
            value={brief.sourceLanguage}
            onChange={(event) => onChange({ sourceLanguage: event.target.value })}
            placeholder="e.g. English"
            disabled={pairLocked}
          />
        </label>

        <datalist id="creation-language-options">
          {COMMON_LANGUAGES.map((language) => (
            <option key={language.code} value={language.name} />
          ))}
        </datalist>

        <label className="field-label brief-wide">
          Study instruction (optional)
          <textarea
            className="field"
            rows={2}
            value={brief.studyInstruction}
            onChange={(event) => onChange({ studyInstruction: event.target.value })}
            placeholder="e.g. Read the English line, then type the full Polish line."
            disabled={pairLocked}
          />
        </label>

        <p className="brief-note brief-wide" style={{ margin: 0 }}>
          {pairLocked
            ? `This target uses ${languagePairLabel({
                language: brief.targetLanguage,
                sourceLanguage: brief.sourceLanguage,
              })}. The pack owns its language pair and instruction.`
            : "The pack stores this pair and instruction. Every deck and card inherits them."}
        </p>

        {target === "pack" ? (
          <label className="field-label brief-wide">
            Pack name (optional)
            <input
              className="field"
              value={brief.packName}
              onChange={(event) => onChange({ packName: event.target.value })}
              placeholder="Leave blank and the AI names it"
            />
          </label>
        ) : null}

        {target === "deck" ? (
          <label className="field-label brief-wide">
            Deck name (optional)
            <input
              className="field"
              value={brief.deckName}
              onChange={(event) => onChange({ deckName: event.target.value })}
              placeholder="Leave blank and the AI names it"
            />
          </label>
        ) : null}

        {target === "cards" ? (
          <p className="brief-note brief-wide" style={{ margin: 0 }}>
            New cards join the pack and deck you chose above. The subject starts from that deck and
            remains editable.
          </p>
        ) : null}
      </div>
    </section>
  );
}
