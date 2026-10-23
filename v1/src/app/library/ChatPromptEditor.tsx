// WHY: A Chat prompt is a request the learner may correct. Showing the exact
// text in an editable box, with copy and download using that edited text, makes
// the control real without weakening the importer that checks the answer.
// PACK: creation-control
// 2026-10-22 opencode: created for the editable Chat prompt [pack: creation-control]

/** What the editor needs to show one exact, editable request. */
interface ChatPromptEditorProps {
  prompt: string;
  loading: boolean;
  needsSubject: boolean;
  targetReady: boolean;
  onChange: (prompt: string) => void;
  onRebuild: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

export default function ChatPromptEditor({
  prompt,
  loading,
  needsSubject,
  targetReady,
  onChange,
  onRebuild,
  onCopy,
  onDownload,
}: ChatPromptEditorProps) {
  const blocked = needsSubject || !targetReady;
  const hasPrompt = prompt.trim().length > 0;

  return (
    <div className="prompt-box">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>Editable prompt</strong>
        <span className="badge">You can edit this</span>
      </div>

      {needsSubject ? (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Write what you want the cards to teach. The prompt appears here once the brief has a
          subject.
        </p>
      ) : !targetReady ? (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Choose the pack and deck this prompt should write into.
        </p>
      ) : loading ? (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Building the prompt...
        </p>
      ) : (
        <label className="field-label" style={{ marginTop: 8 }}>
          Prompt
          <textarea
            className="field prompt-editor"
            rows={14}
            spellCheck={false}
            value={prompt}
            onChange={(event) => onChange(event.target.value)}
            placeholder="The prompt will appear here."
          />
        </label>
      )}

      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn"
          type="button"
          onClick={onRebuild}
          disabled={blocked || loading}
        >
          Rebuild prompt
        </button>
        <button className="btn" type="button" onClick={onCopy} disabled={!hasPrompt || blocked}>
          Copy the prompt
        </button>
        <button className="btn" type="button" onClick={onDownload} disabled={!hasPrompt || blocked}>
          Download .md
        </button>
      </div>

      <p className="brief-note" style={{ margin: "8px 0 0" }}>
        Copy and download use the edited text. The pasted answer still goes through the strict
        importer, so editing cannot bypass validation.
      </p>
    </div>
  );
}
