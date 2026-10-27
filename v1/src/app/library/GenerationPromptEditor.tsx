// WHY: The learner must see the exact prompt before it leaves and be able to
// correct it, so the box is the request and send uses its text. The answer still
// goes through the strict importer, so an edit cannot bypass validation.
// PACK: D-30
// 2026-10-27 qoder: created for the editable Generate prompt [D-30]

/** What the editor needs to show one exact, editable provider request. */
interface GenerationPromptEditorProps {
  prompt: string;
  model: string | null;
  providerReady: boolean;
  busy: boolean;
  onChange: (prompt: string) => void;
  onRebuild: () => void;
  onCopy: () => void;
  onCancel: () => void;
  onSend: () => void;
}

export default function GenerationPromptEditor({
  prompt,
  model,
  providerReady,
  busy,
  onChange,
  onRebuild,
  onCopy,
  onCancel,
  onSend,
}: GenerationPromptEditorProps) {
  const hasPrompt = prompt.trim().length > 0;

  return (
    <div className="prompt-box">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>Editable prompt</strong>
        <span className="badge">You can edit this</span>
      </div>

      <p style={{ margin: "8px 0 0" }}>
        {providerReady ? (
          <>
            This is exactly what will be sent to <strong>{model}</strong>. Nothing leaves until
            you press send.
          </>
        ) : (
          <>This is exactly what would be sent. Nothing leaves this machine until a provider is ready.</>
        )}
      </p>

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

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" type="button" onClick={onSend} disabled={busy || !hasPrompt}>
          Send it
        </button>
        <button className="btn" type="button" onClick={onCopy} disabled={!hasPrompt}>
          Copy the prompt
        </button>
        <button className="btn" type="button" onClick={onRebuild} disabled={busy}>
          Rebuild prompt
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <p className="brief-note" style={{ margin: "8px 0 0" }}>
        The words in this box are what gets sent. The answer still goes through the strict
        importer, so editing cannot bypass validation.
      </p>
    </div>
  );
}
