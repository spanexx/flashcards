"use client";

// WHY: Creating starts with the object, then the method. Every path ends in the
// same validator, so a generated answer, a chat answer and a pasted file are
// checked the same way. This panel is the only place that writes new content.
// PACK: library-create-flow
// 2026-10-21 opencode: created for the target-first Create panel [pack: library-create-flow]
// 2026-10-23 opencode: Generate, Import and Chat import enqueue page-level jobs
// instead of holding the Create screen. [pack: background-jobs]

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import type { JobView } from "@/lib/browser/jobs";
import type { PackStatus, ProviderStatus } from "@/lib/shared/types";
import { defaultCreationBrief, type CreationBrief } from "@/lib/shared/creation";
import ChatPromptEditor from "./ChatPromptEditor";
import CreationBriefFields from "./CreationBriefFields";
import PlacementPicker from "./PlacementPicker";
import {
  briefForTarget,
  briefNeedsSubject,
  briefSubjectDefault,
  errorLines,
  packDecks,
  type CreateMethod,
  type CreateResult,
  type CreateSeed,
  type CreateTarget,
} from "./library-utils";

/** A link that leaves Create mounted, so a half-written draft stays put. */
function SettingsPath() {
  return (
    <a href="/settings" target="_blank" rel="noreferrer">
      Open Settings in a new tab
    </a>
  );
}

/** What the Create panel needs from the shell and its loaded library. */
interface CreatePanelProps {
  packs: PackStatus[];
  provider: ProviderStatus | null;
  seed: CreateSeed | null;
  onCreated: (result: CreateResult, notice: string) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export default function CreatePanel({ packs, provider, seed, onCreated, onError, onNotice }: CreatePanelProps) {
  const [target, setTarget] = useState<CreateTarget>(seed?.target ?? "pack");
  const [method, setMethod] = useState<CreateMethod>(seed?.method ?? "write");
  const [packChoice, setPackChoice] = useState(seed?.packName ?? "");
  const [deckChoice, setDeckChoice] = useState(seed?.deckId ?? "");
  const [writePack, setWritePack] = useState({ name: "", version: "1.0.0", deckName: "Basics" });
  const [deckName, setDeckName] = useState("");
  const [cardDraft, setCardDraft] = useState({
    front: "",
    back: "",
    summary: "",
    mode: "auto",
    options: "",
  });
  const [counts, setCounts] = useState<Record<CreateTarget, number>>({ pack: 10, deck: 5, cards: 5 });
  const [importText, setImportText] = useState("");
  const [brief, setBrief] = useState<CreationBrief>(() => {
    const wantedTarget = seed?.target ?? "pack";
    if (wantedTarget === "pack") return defaultCreationBrief();
    const pack =
      packs.find((entry) => entry.name === seed?.packName && !entry.error) ??
      packs.find((entry) => !entry.error);
    if (!pack) return defaultCreationBrief();
    const firstDeck = packDecks(pack).find((deck) => deck.id === seed?.deckId) ?? packDecks(pack)[0];
    return defaultCreationBrief({
      subject: briefSubjectDefault(packs, wantedTarget, pack.name, firstDeck?.id ?? ""),
    });
  });
  const [chatState, setChatState] = useState<{ key: string; prompt: string } | null>(null);
  const [chatVersion, setChatVersion] = useState(0);
  const [chatAnswer, setChatAnswer] = useState<{ key: string; text: string }>({
    key: "",
    text: "",
  });
  const [prepared, setPrepared] = useState<{ requestId: string; prompt: string } | null>(null);
  const [keyNeeded, setKeyNeeded] = useState(false);
  const [freshProvider, setFreshProvider] = useState<ProviderStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // A seed arrives when Packs sends the learner here already aimed at a target.
  // The shell gives the panel a new key, so this is starting state, not a fix-up.

  // The pack and deck come from the loaded list. A deleted choice falls back to
  // the first real one without an effect that paints the stale choice once.
  const readablePacks = packs.filter((pack) => !pack.error);
  const activePack = readablePacks.find((pack) => pack.name === packChoice) ?? readablePacks[0];
  const packName = activePack?.name ?? "";
  const activeDecks = activePack ? packDecks(activePack) : [];
  const deckId = activeDecks.some((deck) => deck.id === deckChoice) ? deckChoice : (activeDecks[0]?.id ?? "");

  // Only the target's matching name may reach a prompt; stale fields are stripped.
  const requestBrief = briefForTarget(brief, target);
  const subjectNeeded = briefNeedsSubject(requestBrief);
  const chatTargetReady =
    target === "pack" || (Boolean(packName) && (target === "deck" || Boolean(deckId)));
  const chatRequestKey = JSON.stringify({ target, packName, deckId, brief: requestBrief });
  const chatBuildKey = JSON.stringify({ request: chatRequestKey, version: chatVersion });
  const chatPrompt = chatState?.key === chatBuildKey ? chatState.prompt : "";
  const chatLoading =
    method === "chat" &&
    chatTargetReady &&
    !subjectNeeded &&
    chatState?.key !== chatBuildKey;
  const chatAnswerText = chatAnswer.key === chatBuildKey ? chatAnswer.text : "";

  // The shell's provider read is a snapshot; a fresh one is taken before Generate.
  const liveProvider = freshProvider ?? provider;
  const providerConfigured = Boolean(liveProvider?.configured);
  const providerReady = Boolean(liveProvider?.configured && liveProvider.hasKey);
  const currentCount = counts[target];

  // Show the server's plain message and every field it named.
  const showError = useCallback(
    (problem: unknown, fallback: string) => {
      onError(problem instanceof Error ? problem.message : fallback);
      const lines = errorLines(problem);
      onNotice(lines.length > 0 ? lines.join(" · ") : null);
    },
    [onError, onNotice],
  );

  // Changing target keeps the method but drops a prompt that belonged to the old one.
  const chooseTarget = (next: CreateTarget) => {
    setTarget(next);
    const nextPack = readablePacks.find((pack) => pack.name === packChoice) ?? readablePacks[0];
    const nextDecks = nextPack ? packDecks(nextPack) : [];
    const nextDeckId = nextDecks.some((deck) => deck.id === deckChoice)
      ? deckChoice
      : (nextDecks[0]?.id ?? "");
    setBrief((previous) => ({
      ...previous,
      subject: briefSubjectDefault(packs, next, nextPack?.name ?? "", nextDeckId),
      packName: next === "pack" ? previous.packName : "",
      deckName: next === "deck" ? previous.deckName : "",
    }));
    setPrepared(null);
    setKeyNeeded(false);
    onError(null);
  };

  // Changing method keeps the target and every draft field.
  const chooseMethod = (next: CreateMethod) => {
    setMethod(next);
    setPrepared(null);
    setKeyNeeded(false);
    onError(null);
  };

  // Changing the pack moves the deck to that pack's first deck and re-prefills
  // the subject only because the container itself changed.
  const choosePack = (name: string) => {
    setPackChoice(name);
    const pack = packs.find((entry) => entry.name === name);
    const nextDeck = pack ? (packDecks(pack)[0]?.id ?? "") : "";
    setDeckChoice(nextDeck);
    setBrief((previous) => ({
      ...previous,
      subject: briefSubjectDefault(packs, target, name, nextDeck),
    }));
    setPrepared(null);
  };

  // A different deck invalidates a prepared prompt for the old deck.
  const chooseDeck = (id: string) => {
    setDeckChoice(id);
    setBrief((previous) => ({
      ...previous,
      subject: briefSubjectDefault(packs, target, packName, id),
    }));
    setPrepared(null);
  };

  // Every brief edit invalidates a prepared prompt; it described the old brief.
  // The Chat effect keys off the brief and rebuilds its prompt on its own.
  const updateBrief = (patch: Partial<CreationBrief>) => {
    setBrief((previous) => ({ ...previous, ...patch }));
    setPrepared(null);
    setKeyNeeded(false);
    onError(null);
  };

  // Every method below needs the same target shape.
  const targetPayload = ():
    | { kind: "pack" }
    | { kind: "deck"; packName: string }
    | { kind: "cards"; packName: string; deckId: string }
    | null => {
    if (target === "pack") return { kind: "pack" };
    if (!packName) return null;
    if (target === "deck") return { kind: "deck", packName };
    if (!deckId) return null;
    return { kind: "cards", packName, deckId };
  };

  // Pack and Deck success open Packs; Cards success opens the filtered Cards tab.
  const finish = (result: CreateResult, notice: string) => {
    setPrepared(null);
    onNotice(notice);
    onCreated(result, notice);
  };

  // Write a pack. The server derives the ids; the learner writes plain names.
  const writePackNow = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      const data = await apiSend<{ pack: { name: string } }>("/api/packs", "POST", {
        name: writePack.name,
        version: writePack.version,
        deckName: writePack.deckName,
      });
      const name = data.pack.name;
      setWritePack({ name: "", version: "1.0.0", deckName: "Basics" });
      finish({ kind: "pack", packName: name }, `The pack "${name}" was created with one deck.`);
    } catch (problem) {
      showError(problem, "The pack could not be created.");
    } finally {
      setBusy(false);
    }
  };

  // Write one empty deck into the chosen pack.
  const writeDeckNow = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      if (!packName) throw new Error("Choose the pack this deck belongs to.");
      const data = await apiSend<{ pack: { name: string }; deck: { id: string; name: string } | null }>(
        `/api/packs/${encodeURIComponent(packName)}/decks`,
        "POST",
        { name: deckName },
      );
      if (!data.deck) throw new Error("The deck was not returned after it was saved.");
      setDeckName("");
      finish(
        { kind: "deck", packName: data.pack.name, deckId: data.deck.id },
        `The deck "${data.deck.name}" was created in "${data.pack.name}".`,
      );
    } catch (problem) {
      showError(problem, "The deck could not be created.");
    } finally {
      setBusy(false);
    }
  };

  // Write one card into the chosen pack and deck.
  const writeCardNow = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      if (!packName || !deckId) throw new Error("Choose the pack and deck this card belongs to.");
      const options = cardDraft.options.split(",").map((option) => option.trim()).filter((option) => option.length > 0);
      await apiSend("/api/cards", "POST", {
        front: cardDraft.front,
        back: cardDraft.back,
        summary: cardDraft.summary || undefined,
        packName,
        deckId,
        mode: cardDraft.mode,
        options: cardDraft.mode === "picks" ? options : undefined,
      });
      const pack = packs.find((entry) => entry.name === packName);
      const label = pack ? (packDecks(pack).find((deck) => deck.id === deckId)?.name ?? deckId) : deckId;
      setCardDraft({ front: "", back: "", summary: "", mode: "auto", options: "" });
      finish({ kind: "cards", packName, deckId, count: 1 }, `The card was added to "${packName}" → ${label}.`);
    } catch (problem) {
      showError(problem, "The card could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  // Import is strict: the file must match the chosen target, never another shape.
  // The validator runs in the background job, so Create is free immediately.
  const importNow = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      const wanted = targetPayload();
      if (!wanted) throw new Error("Choose the parent pack and deck first.");
      await apiSend<{ job: JobView }>("/api/jobs", "POST", {
        kind: "import",
        text: importText,
        target: wanted,
        namePolicy: "strict",
        source: "file",
      });
      setImportText("");
      onNotice("Import started. You can keep working.");
    } catch (problem) {
      showError(problem, "The import could not start.");
    } finally {
      setBusy(false);
    }
  };

  // Build a fresh editable prompt whenever the method, target, parent or brief
  // changes. A short delay keeps typing in the brief from starting a request on
  // every keystroke. A response from an old request is ignored, and the key
  // makes the old prompt and answer invisible until the new one arrives.
  useEffect(() => {
    if (method !== "chat") return;
    if (!chatTargetReady || subjectNeeded) return;
    const wanted =
      target === "pack"
        ? { kind: "pack" as const }
        : target === "deck"
          ? { kind: "deck" as const, packName }
          : { kind: "cards" as const, packName, deckId };
    const requestBrief = briefForTarget(brief, target);
    let alive = true;
    const timer = setTimeout(() => {
      void apiSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
        target: wanted,
        brief: requestBrief,
      })
        .then((data) => {
          if (!alive) return;
          setChatState({ key: chatBuildKey, prompt: data.prompt });
        })
        .catch((problem: unknown) => {
          if (!alive) return;
          setChatState({ key: chatBuildKey, prompt: "" });
          showError(problem, "The authoring prompt could not be built.");
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [method, target, packName, deckId, brief, chatTargetReady, subjectNeeded, chatBuildKey, showError]);

  // The learner can ask for a fresh prompt without changing the brief.
  const rebuildChatPrompt = () => setChatVersion((previous) => previous + 1);

  // An edit belongs to the prompt key that was on screen when it was typed.
  const editChatPrompt = (prompt: string) => setChatState({ key: chatBuildKey, prompt });

  // Copy the exact prompt into any chat. A blocked clipboard is named, not hidden.
  const copyChatPrompt = async () => {
    try {
      await navigator.clipboard.writeText(chatPrompt);
      onNotice("The authoring prompt was copied. Paste the chat's JSON answer below.");
    } catch {
      onError("The prompt could not be copied automatically. Select it and copy by hand.");
    }
  };

  // Download works when the clipboard is blocked.
  const downloadChatPrompt = () => {
    const blob = new Blob([chatPrompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flashcards-authoring-prompt.md";
    anchor.click();
    URL.revokeObjectURL(url);
    onNotice("The authoring prompt was downloaded.");
  };

  // A pasted Chat answer is the same strict import, so it uses the same job path
  // with the generated-name suffix policy the Chat flow already promised.
  const importChatAnswer = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      const wanted = targetPayload();
      if (!wanted) throw new Error("Choose the parent pack and deck first.");
      await apiSend<{ job: JobView }>("/api/jobs", "POST", {
        kind: "import",
        text: chatAnswerText,
        target: wanted,
        namePolicy: "auto-suffix",
        source: "chat",
      });
      setChatAnswer({ key: chatBuildKey, text: "" });
      onNotice("The chat answer was queued. You can keep working.");
    } catch (problem) {
      showError(problem, "The chat's answer could not be queued.");
    } finally {
      setBusy(false);
    }
  };

  // Prepare reads the provider again, so a key saved in another tab is seen here.
  const prepareNow = async () => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      const wanted = targetPayload();
      if (!wanted) throw new Error("Choose the parent pack and deck first.");
      if (subjectNeeded) throw new Error("Write what you want the cards to teach first.");
      const settings = await apiGet<{ provider: ProviderStatus }>("/api/settings");
      setFreshProvider(settings.provider);
      if (!settings.provider.configured) {
        onNotice("No provider is set up. Your draft stays here while you add one in Settings.");
        return;
      }
      if (!settings.provider.hasKey) {
        setKeyNeeded(true);
        return;
      }
      setKeyNeeded(false);
      const data = await apiSend<{ requestId: string; prompt: string }>("/api/provider/prepare", "POST", {
        target: wanted,
        count: currentCount,
        brief: requestBrief,
      });
      setPrepared({ requestId: data.requestId, prompt: data.prompt });
    } catch (problem) {
      showError(problem, "The prompt could not be prepared.");
    } finally {
      setBusy(false);
    }
  };

  // Send the one held prompt into the page-level queue. The runner keeps the
  // whole batch or none of it, and Create is free again after the enqueue.
  const sendNow = async () => {
    if (!prepared) return;
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      await apiSend<{ job: JobView }>("/api/jobs", "POST", {
        kind: "generation",
        requestId: prepared.requestId,
      });
      setPrepared(null);
      onNotice("Generation started. You can keep working.");
    } catch (problem) {
      setPrepared(null);
      showError(problem, "The generation could not start.");
    } finally {
      setBusy(false);
    }
  };

  // One row of target choices; the object is chosen before the method.
  const targetChoices: Array<[CreateTarget, string, string]> = [
    ["pack", "Pack", "A whole new pack. It always gets at least one deck."],
    ["deck", "Deck", "A new deck inside a pack you already have."],
    ["cards", "Cards", "New cards inside an existing pack and deck."],
  ];

  // One row of method choices. Generate carries the provider readiness badge.
  const methodChoices: Array<[CreateMethod, string, string, string]> = [
    ["write", "W", "Write", "Fill in the fields yourself."],
    ["generate", "G", "Generate", "Use the saved provider profile."],
    ["chat", "C", "Chat", "Edit or copy a prompt, then paste the answer."],
    ["import", "I", "Import", "Choose a file or paste plain JSON."],
  ];

  const providerBadge = providerReady ? (
    <span className="badge ok">Ready</span>
  ) : providerConfigured ? (
    <span className="badge warn">Needs key</span>
  ) : (
    <span className="badge bad">Set up first</span>
  );

  const titles: Record<CreateTarget, string> = { pack: "New pack", deck: "New deck", cards: "New cards" };
  const methodTitles: Record<CreateMethod, string> = {
    write: "Write",
    generate: "Generate",
    chat: "Chat",
    import: "Import",
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="split-head">
          <div>
            <h2 style={{ margin: 0 }}>1. What are you making?</h2>
            <p className="muted" style={{ margin: "3px 0 0" }}>
              Choose the object first. The method comes second.
            </p>
          </div>
          <span className="pill">{target}</span>
        </div>
        <div className="choice-grid three">
          {targetChoices.map(([id, name, text]) => (
            <button
              className="choice"
              type="button"
              key={id}
              aria-pressed={target === id}
              onClick={() => chooseTarget(id)}
            >
              <span className="glyph">{name[0]}</span>
              <strong>{name}</strong>
              <span className="muted">{text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="split-head">
          <div>
            <h2 style={{ margin: 0 }}>2. How?</h2>
            <p className="muted" style={{ margin: "3px 0 0" }}>
              Every method uses the same validation.
            </p>
          </div>
        </div>
        <div className="choice-grid four">
          {methodChoices.map(([id, letter, name, text]) => (
            <button
              className="choice"
              type="button"
              key={id}
              aria-pressed={method === id}
              onClick={() => chooseMethod(id)}
            >
              <span className="glyph">{letter}</span>
              <strong>{name}</strong>
              <span className="muted">{text}</span>
              {id === "generate" ? <span style={{ display: "block", marginTop: 6 }}>{providerBadge}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="create-grid">
        <div className="card">
          <div className="split-head">
            <h2 style={{ margin: 0 }}>
              {methodTitles[method]} → {titles[target]}
            </h2>
            <span className="pill">
              {method === "generate" ? "one batch, all or nothing" : "validated before saving"}
            </span>
          </div>

          {method === "write" && target === "pack" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              <label className="field-label">
                Pack name
                <input
                  className="field"
                  value={writePack.name}
                  onChange={(event) => setWritePack((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="My pack"
                />
              </label>
              <label className="field-label">
                Version
                <input
                  className="field"
                  value={writePack.version}
                  onChange={(event) => setWritePack((previous) => ({ ...previous, version: event.target.value }))}
                  placeholder="1.0.0"
                />
              </label>
              <label className="field-label">
                First deck name
                <input
                  className="field"
                  value={writePack.deckName}
                  onChange={(event) => setWritePack((previous) => ({ ...previous, deckName: event.target.value }))}
                  placeholder="Basics"
                />
              </label>
              <p className="muted" style={{ margin: 0 }}>
                The deck can start empty. Cards come later through Create → Cards. A name that is already here is
                refused; learner-written names do not auto-number.
              </p>
              <div className="row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void writePackNow()}
                  disabled={busy || !writePack.name.trim()}
                >
                  Create empty pack
                </button>
              </div>
            </div>
          ) : null}

          {method === "write" && target === "deck" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              <PlacementPicker
                packs={packs}
                packName={packName}
                deckId={deckId}
                withDeck={false}
                packLabel="Parent pack"
                deckLabel="Deck"
                onPack={choosePack}
                onDeck={chooseDeck}
              />
              <label className="field-label">
                Deck name
                <input
                  className="field"
                  value={deckName}
                  onChange={(event) => setDeckName(event.target.value)}
                  placeholder="Everyday verbs"
                />
              </label>
              <p className="muted" style={{ margin: 0 }}>
                The deck can start empty. Cards come later through Create → Cards.
              </p>
              <div className="row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void writeDeckNow()}
                  disabled={busy || !packName || !deckName.trim()}
                >
                  Create empty deck
                </button>
              </div>
            </div>
          ) : null}

          {method === "write" && target === "cards" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              <PlacementPicker
                packs={packs}
                packName={packName}
                deckId={deckId}
                withDeck
                packLabel="Pack"
                deckLabel="Deck"
                onPack={choosePack}
                onDeck={chooseDeck}
              />
              <label className="field-label">
                Front
                <input
                  className="field"
                  value={cardDraft.front}
                  onChange={(event) => setCardDraft((previous) => ({ ...previous, front: event.target.value }))}
                  placeholder="To jest kot."
                />
              </label>
              <label className="field-label">
                Back
                <input
                  className="field"
                  value={cardDraft.back}
                  onChange={(event) => setCardDraft((previous) => ({ ...previous, back: event.target.value }))}
                  placeholder="This is a cat."
                />
              </label>
              <div className="row">
                <label className="field-label">
                  Answer style
                  <select
                    className="field"
                    value={cardDraft.mode}
                    onChange={(event) => setCardDraft((previous) => ({ ...previous, mode: event.target.value }))}
                  >
                    <option value="auto">Guess the mode</option>
                    <option value="cloze">Hide a word</option>
                    <option value="picks">Pick from options</option>
                    <option value="type">Type the answer</option>
                  </select>
                </label>
                {cardDraft.mode === "picks" ? (
                  <label className="field-label" style={{ flex: "1 1 12rem" }}>
                    Options
                    <input
                      className="field"
                      value={cardDraft.options}
                      onChange={(event) => setCardDraft((previous) => ({ ...previous, options: event.target.value }))}
                      placeholder="kot, pies, dom"
                    />
                  </label>
                ) : null}
              </div>
              <label className="field-label">
                Short name (optional)
                <input
                  className="field"
                  value={cardDraft.summary}
                  onChange={(event) => setCardDraft((previous) => ({ ...previous, summary: event.target.value }))}
                  placeholder="A cat"
                />
              </label>
              <div className="row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void writeCardNow()}
                  disabled={busy || !packName || !deckId || !cardDraft.front || !cardDraft.back}
                >
                  Add card
                </button>
              </div>
            </div>
          ) : null}

          {method === "generate" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              {liveProvider === null ? (
                <p className="muted">Checking the provider setup...</p>
              ) : !providerConfigured ? (
                <div className="notice">
                  <strong>No provider profile yet.</strong>
                  <p style={{ margin: "4px 0" }}>
                    Generate needs a provider URL and model. Save them in Settings, then come back. Your draft stays
                    here.
                  </p>
                  <div className="row">
                    <SettingsPath />
                    <button className="btn small" type="button" onClick={() => chooseMethod("chat")}>
                      Use Chat instead
                    </button>
                  </div>
                </div>
              ) : keyNeeded && !providerReady ? (
                <div className="notice error">
                  <strong>The provider key is missing.</strong>
                  <p style={{ margin: "4px 0" }}>Save the key in Settings, then press Generate again. Your draft stays here.</p>
                  <div className="row">
                    <SettingsPath />
                    <button className="btn small" type="button" onClick={() => chooseMethod("chat")}>
                      Use Chat instead
                    </button>
                  </div>
                </div>
              ) : null}

              {target !== "pack" ? (
                <PlacementPicker
                  packs={packs}
                  packName={packName}
                  deckId={deckId}
                  withDeck={target === "cards"}
                  packLabel="Parent pack"
                  deckLabel="Deck"
                  onPack={choosePack}
                  onDeck={chooseDeck}
                />
              ) : (
                <div className="notice">
                  <strong>{requestBrief.packName.trim() ? "Your pack name will be used." : "The AI names the new pack."}</strong>
                  <p style={{ margin: "4px 0" }}>
                    Leave the pack name blank to let the AI choose. If a name already exists, the app appends 2, 3,
                    and so on. The AI also decides the decks unless you name one.
                  </p>
                </div>
              )}

              <CreationBriefFields
                target={target}
                brief={requestBrief}
                packs={packs}
                onChange={updateBrief}
              />

              <label className="field-label" style={{ maxWidth: "10rem" }}>
                {target === "pack" ? "Total cards" : target === "deck" ? "Cards in the new deck" : "Cards to add"}
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={20}
                  value={currentCount}
                  onChange={(event) =>
                    setCounts((previous) => ({
                      ...previous,
                      [target]: Math.min(20, Math.max(1, Number(event.target.value) || 1)),
                    }))
                  }
                />
              </label>

              <div className="row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void prepareNow()}
                  disabled={busy || !chatTargetReady || subjectNeeded}
                >
                  Prepare the prompt
                </button>
              </div>

              {prepared ? (
                <div className="stack">
                  <p style={{ margin: 0 }}>
                    {providerReady ? (
                      <>
                        This is exactly what will be sent to <strong>{liveProvider?.model}</strong>. Nothing leaves until
                        you press send.
                      </>
                    ) : (
                      <>This is exactly what would be sent. Nothing leaves this machine until a provider is ready.</>
                    )}
                  </p>
                  <pre className="code-block">{prepared.prompt}</pre>
                  <div className="row">
                    <button className="btn primary" type="button" onClick={() => void sendNow()} disabled={busy}>
                      Send it
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(prepared.prompt)
                          .then(() => onNotice("The prompt was copied."))
                          .catch(() => onError("The prompt could not be copied automatically. Select it and copy by hand."));
                      }}
                    >
                      Copy the prompt
                    </button>
                    <button className="btn" type="button" onClick={() => setPrepared(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {method === "chat" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              {target !== "pack" ? (
                <PlacementPicker
                  packs={packs}
                  packName={packName}
                  deckId={deckId}
                  withDeck={target === "cards"}
                  packLabel="Parent pack"
                  deckLabel="Deck"
                  onPack={choosePack}
                  onDeck={chooseDeck}
                />
              ) : null}
              <CreationBriefFields
                target={target}
                brief={requestBrief}
                packs={packs}
                onChange={updateBrief}
              />
              <ChatPromptEditor
                prompt={chatPrompt}
                loading={chatLoading}
                needsSubject={subjectNeeded}
                targetReady={chatTargetReady}
                onChange={editChatPrompt}
                onRebuild={rebuildChatPrompt}
                onCopy={() => void copyChatPrompt()}
                onDownload={downloadChatPrompt}
              />
              <label className="field-label">
                Paste the chat answer
                <textarea
                  className="answer-input"
                  rows={6}
                  value={chatAnswerText}
                  onChange={(event) =>
                    setChatAnswer({ key: chatBuildKey, text: event.target.value })
                  }
                  placeholder="Paste the chat's JSON answer here"
                />
              </label>
              <div className="row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void importChatAnswer()}
                  disabled={busy || !chatAnswerText.trim()}
                >
                  Check and save
                </button>
              </div>
            </div>
          ) : null}

          {method === "import" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              {target !== "pack" ? (
                <PlacementPicker
                  packs={packs}
                  packName={packName}
                  deckId={deckId}
                  withDeck={target === "cards"}
                  packLabel="Parent pack"
                  deckLabel="Deck"
                  onPack={choosePack}
                  onDeck={chooseDeck}
                />
              ) : null}
              <div className="notice">
                <strong>
                  This target accepts{" "}
                  {target === "pack" ? "a whole pack" : target === "deck" ? "new decks only" : "cards only"}.
                </strong>
                <p style={{ margin: "4px 0" }}>
                  A different kind is refused; switch target instead of letting Import guess.
                </p>
              </div>
              <label className="field-label">
                Choose a file
                <input
                  className="field"
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void file.text().then((text) => setImportText(text));
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="field-label">
                Or paste the text
                <textarea
                  className="answer-input"
                  rows={5}
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder="Paste the JSON here"
                />
              </label>
              <div className="row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void importNow()}
                  disabled={busy || !importText.trim()}
                >
                  Check and import
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="card tight">
          <h3>What happens</h3>
          <div className="stack muted" style={{ marginTop: 9 }}>
            <p style={{ margin: 0 }}>
              <strong>No preview.</strong> Generated content saves only after the whole result passes validation.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Delete is the undo.</strong> Packs and decks can be removed from Packs after typing their name.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Names:</strong> Write uses your name. Generate and Chat use the optional name you type, or let
              the AI choose when it is blank. A collision gets 2, 3, and so on.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Your brief:</strong> the subject, focus and card style are the request. The AI can name
              containers, but it cannot quietly replace the learning goal.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Imports are strict.</strong> A pack file under Deck is refused; switch target instead.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
