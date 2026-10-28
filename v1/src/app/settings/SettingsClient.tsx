"use client";

// WHY: One screen for the small number of choices the app asks the learner to
// make, plus the receipts a person needs to trust it: which store holds the
// key, where the browser copy lives, and what the planner did last. Four tabs
// keep each kind of choice from competing with the others.
// PACK: browser-app
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-19 opencode: tabbed shell [pack: v1-prototype]
// 2026-10-20 opencode: browser backup, restore and autosave [pack: browser-app]
// 2026-10-20 opencode: visible provider profile and connection test [pack: browser-app]
// 2026-10-20 opencode: a successful connection notice clears itself, while the
// session-only Tested state stays. [pack: browser-app]
// 2026-10-25 opencode: profile selects use the shared field family so they stack
// cleanly on a phone. [pack: learner-interface]
// 2026-10-25 opencode: Appearance card holds the theme and sound choices.
// [pack: learner-delight]
// 2026-10-26 qoder: Appearance also holds the teaching layer's automatic
// opening. [pack: study-resilience]

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { systemEnabled, systemProviderName } from "@/lib/client/system";
import SoundSwitch from "./SoundSwitch";
import SystemProviderCard, { type CheckoutReturn } from "./SystemProviderCard";
import TeachingSwitch from "./TeachingSwitch";
import ThemeSwitch from "./ThemeSwitch";
import {
  autosaveNow,
  autosaveState,
  chooseAutosaveFile,
  disconnectAutosave,
  type AutosaveState,
} from "@/lib/browser/autosave";
import { exportBackupZip, restoreBackupFile } from "@/lib/browser/archive";
import { interruptJobs } from "@/lib/browser/jobs";
import type { ProviderStatus, Settings } from "@/lib/shared/types";

interface PromptLogEntry {
  at: string;
  kind: "generation" | "hint";
  requestId: string;
  endpoint: string | null;
  model: string | null;
  prompt: string;
}

type SettingsTab = "profile" | "provider" | "prompts" | "data";

/** The short name a learner can recognise without reading the whole address. */
function providerName(endpoint: string | null): string {
  if (!endpoint) return "No provider saved";
  try {
    return new URL(endpoint).host || endpoint;
  } catch {
    return endpoint;
  }
}

export default function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [folders, setFolders] = useState({ data: "", packs: "" });
  const [version, setVersion] = useState("");
  const [url, setUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tested, setTested] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  const [log, setLog] = useState<PromptLogEntry[]>([]);
  const [backupText, setBackupText] = useState("");
  const [auto, setAuto] = useState<AutosaveState>({
    supported: false,
    fileName: null,
    lastSavedAt: null,
    permission: null,
  });
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [checkout, setCheckout] = useState<CheckoutReturn | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<{
        settings: Settings;
        provider: ProviderStatus;
        folders: { data: string; packs: string };
        version: string;
      }>("/api/settings");
      setSettings(data.settings);
      setProvider(data.provider);
      setFolders(data.folders);
      setVersion(data.version);
      setUrl(data.settings.provider.url);
      setModel(data.settings.provider.model);
      const prompts = await apiGet<{ entries: PromptLogEntry[] }>("/api/prompts?limit=50");
      setLog(prompts.entries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings could not be read.");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => refresh());
    return () => {
      void pending;
    };
  }, [refresh]);

  // WHY: Stripe sends the learner back with the outcome in the query. Read it
  // once, remember it for the system card, then clean the address bar so a
  // reload does not repeat the exchange. [pack: system-provider-subscription]
  useEffect(() => {
    const pending = Promise.resolve().then(() => {
      const query = new URLSearchParams(window.location.search);
      const outcome = query.get("checkout");
      const sessionId = query.get("session_id");
      if (outcome === "success" && sessionId) {
        setCheckout({ kind: "success", sessionId });
      } else if (outcome === "cancel") {
        setCheckout({ kind: "cancel" });
      } else {
        return;
      }
      setTab("provider");
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("checkout");
      cleaned.searchParams.delete("session_id");
      window.history.replaceState({}, "", cleaned.toString());
    });
    return () => {
      void pending;
    };
  }, []);

  useEffect(() => {
    const pending = autosaveState().then(setAuto);
    pending.catch(() =>
      setAuto({ supported: false, fileName: null, lastSavedAt: null, permission: null }),
    );
  }, []);

  useEffect(() => {
    if (!testResult?.ok) return;
    const timer = window.setTimeout(() => setTestResult(null), 6000);
    return () => window.clearTimeout(timer);
  }, [testResult]);

  const saveCategories = useCallback(
    async (patch: { level?: string; learningStyle?: string }) => {
      setMessage(null);
      try {
        const data = await apiSend<{ settings: Settings }>("/api/settings", "PATCH", patch);
        setSettings(data.settings);
        setNotice("Saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The change could not be saved.");
      }
    },
    [],
  );

  const saveProvider = useCallback(async () => {
    setMessage(null);
    try {
      // WHY: Saving your own address and model means you want it to answer;
      // this is also the way back from the system provider.
      const data = await apiSend<{ settings: Settings; provider: ProviderStatus }>("/api/settings", "PATCH", {
        provider: { url, model, mode: "custom" },
      });
      setSettings(data.settings);
      setProvider(data.provider);
      setTestResult(null);
      setTested(false);
      setEditingProvider(false);
      setNotice("Your own provider is saved and in use.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The provider could not be saved.");
    }
  }, [model, url]);

  const saveKey = useCallback(async () => {
    setMessage(null);
    try {
      const data = await apiSend<{ name: string; hasKey: boolean }>("/api/provider/key", "POST", { key });
      setKey("");
      setTestResult(null);
      setTested(false);
      setNotice(data.hasKey ? `The key is now held in ${data.name}.` : "The key was cleared.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The key could not be stored.");
    }
  }, [key, refresh]);

  const clearKey = useCallback(async () => {
    setMessage(null);
    try {
      await apiSend("/api/provider/key", "DELETE");
      setTestResult(null);
      setTested(false);
      setNotice("The key was removed from every store this machine can reach.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The key could not be cleared.");
    }
  }, [refresh]);

  const clearCheckout = useCallback(() => setCheckout(null), []);

  const testProvider = useCallback(async () => {
    setTestBusy(true);
    setMessage(null);
    setNotice(null);
    try {
      const data = await apiSend<{ ok: boolean; message: string }>("/api/provider/test", "POST");
      setTestResult(data);
      setTested(data.ok);
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : "The provider could not be tested.",
      });
      setTested(false);
    } finally {
      setTestBusy(false);
    }
  }, []);

  const exportBackup = useCallback(async () => {
    setMessage(null);
    try {
      const blob = await exportBackupZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `flashcards-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("The backup was downloaded as a zip. It holds everything except the provider key.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The backup could not be exported.");
    }
  }, []);

  // A chosen zip may carry local media; an older JSON backup simply has none.
  const restoreFromFile = useCallback(
    async (file: File) => {
      if (
        !window.confirm(
          "Restoring replaces everything in this browser. The provider key and subscription pass stay. Continue?",
        )
      ) {
        return;
      }
      setMessage(null);
      setNotice(null);
      try {
        const result = await restoreBackupFile(file, {
          beforeApply: () => interruptJobs("The library was restored."),
        });
        if (!result.ok) {
          const first = result.issues[0];
          setMessage(
            `Nothing was restored: ${first ? `${first.field}: ${first.message}` : "the backup needs fixing."}`,
          );
          return;
        }
        setNotice(`Restored ${result.packs} pack(s) and ${result.cards} card(s).`);
        await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The backup file could not be read.");
      }
    },
    [refresh],
  );

  const chooseAutoFile = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      const state = await chooseAutosaveFile();
      setAuto(state);
      setNotice(`Autosave is connected to ${state.fileName ?? "the chosen file"}.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "The backup file could not be connected.");
    }
  }, []);

  const stopAuto = useCallback(async () => {
    setMessage(null);
    try {
      setAuto(await disconnectAutosave());
      setNotice("Autosave is off. The backup file itself was left where it is.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Autosave could not be turned off.");
    }
  }, []);

  const saveAutoNow = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      const result = await autosaveNow();
      if (result.ok) setNotice(result.message);
      else setMessage(result.message);
      setAuto(await autosaveState());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The backup file could not be rewritten.");
    }
  }, []);

  const restoreBackup = useCallback(async () => {
    if (
      !window.confirm(
        "Restoring replaces everything in this browser. The provider key and subscription pass stay. Continue?",
      )
    )
      return;
    setMessage(null);
    setNotice(null);
    try {
      const data = await apiSend<{ packs: number; cards: number }>("/api/backup/restore", "POST", { json: backupText });
      setBackupText("");
      setNotice(`Restored ${data.packs} pack(s) and ${data.cards} card(s).`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The backup could not be restored.");
    }
  }, [backupText, refresh]);

  const providerState = !provider
    ? "Not set up"
    : !provider.configured
      ? "Not set up"
      : !provider.hasKey
        ? provider.mode === "system"
          ? "Needs a pass"
          : "Needs a key"
        : tested
          ? "Tested"
          : provider.mode === "system"
            ? "Subscribed"
            : "Set up";
  const providerTested = tested;
  const systemInUse = settings?.provider.mode === "system";

  if (!settings || !provider) {
    return message ? <div className="notice error">{message}</div> : <p className="muted">Loading settings…</p>;
  }

  return (
    <div>
      <h1>Settings</h1>
      <p className="lead">A small number of choices, and honest receipts for each one.</p>

      {message ? <div className="notice error">{message}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <div className="tabs" role="tablist" aria-label="Settings">
        <button className="tab" type="button" role="tab" aria-selected={tab === "profile"} onClick={() => setTab("profile")}>
          Profile
        </button>
        <button className="tab" type="button" role="tab" aria-selected={tab === "provider"} onClick={() => setTab("provider")}>
          Provider
        </button>
        <button className="tab" type="button" role="tab" aria-selected={tab === "prompts"} onClick={() => setTab("prompts")}>
          Prompts
        </button>
        <button className="tab" type="button" role="tab" aria-selected={tab === "data"} onClick={() => setTab("data")}>
          Data
        </button>
      </div>

      {tab === "profile" ? (
        <>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Appearance</h2>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0 }}>Colour theme</p>
                <p className="muted" style={{ margin: 0 }}>
                  System follows your device.
                </p>
              </div>
              <ThemeSwitch />
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0 }}>Sound effects</p>
                <p className="muted" style={{ margin: 0 }}>
                  Small cues for right, nearly, missed, and finishing. Off unless you turn them on.
                </p>
              </div>
              <SoundSwitch />
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0 }}>Open the teaching layer automatically</p>
                <p className="muted" style={{ margin: 0 }}>
                  For beginner cards. You can still open any layer from the bar.
                </p>
              </div>
              <TeachingSwitch />
            </div>
          </div>
          <div className="card">
            <div className="form-grid">
              <label className="field-label">
                Level
                <span className="select-wrap">
                  <select
                    className="field"
                    value={settings.level}
                    onChange={(event) => void saveCategories({ level: event.target.value })}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </span>
              </label>
              <label className="field-label">
                Style
                <span className="select-wrap">
                  <select
                    className="field"
                    value={settings.learningStyle}
                    onChange={(event) => void saveCategories({ learningStyle: event.target.value })}
                  >
                    <option value="examples-first">Examples first</option>
                    <option value="rules-first">Rules first</option>
                    <option value="conversation">Conversation</option>
                    <option value="gentle">Gentle</option>
                  </select>
                </span>
              </label>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              These are categories, not sentences — the tutor never receives anything you wrote.
            </p>
          </div>
        </>
      ) : null}

      {tab === "provider" ? (
        <div className="stack">
          {systemEnabled() ? (
            <SystemProviderCard
              mode={settings.provider.mode ?? "custom"}
              checkout={checkout}
              onChanged={refresh}
              onNotice={setNotice}
              onError={setMessage}
              onReturnHandled={clearCheckout}
            />
          ) : null}

          <div className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0 }}>Provider profile</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {provider.mode === "system"
                    ? `${systemProviderName()} · subscription`
                    : provider.configured
                      ? `${providerName(provider.endpoint)} · ${provider.model}`
                      : "No provider saved yet."}
                </p>
              </div>
              <span
                className={`status-pill ${
                  providerTested || (provider.mode === "system" && provider.hasKey)
                    ? "ready"
                    : providerState === "Needs a key" || providerState === "Needs a pass"
                      ? "waiting"
                      : ""
                }`}
              >
                {providerState}
              </span>
            </div>

            {testResult ? null : (
              <p className="muted" style={{ margin: 0 }}>
                {provider.message}
              </p>
            )}
            <p className="muted" style={{ margin: 0 }}>
              {provider.mode === "system"
                ? `Pass: ${provider.hasKey ? "stored in this browser" : "not stored"} · the operator's key never reaches this page, and backups never include the pass.`
                : `Key: ${provider.hasKey ? "stored in this browser" : "not stored"} · the address and model are saved here too. Backups never include the key.`}
            </p>

            {testResult ? (
              <div className={`notice ${testResult.ok ? "" : "error"}`} role="status">
                {testResult.message}
              </div>
            ) : null}

            <div className="row">
              <button
                className="btn primary"
                type="button"
                onClick={() => void testProvider()}
                disabled={testBusy || !provider.configured}
              >
                {testBusy ? "Testing…" : "Test connection"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => setEditingProvider((previous) => !previous)}
              >
                {editingProvider ? "Close setup" : "Edit setup"}
              </button>
            </div>
          </div>

          {editingProvider || !provider.configured || !provider.hasKey ? (
            <div className="card stack">
              <div>
                <h2 style={{ margin: 0 }}>Set up your own provider</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Use an OpenAI-compatible address and model. The key stays in this browser and is never shown back.
                </p>
                {systemInUse ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Saving here switches from the subscription back to your own provider.
                  </p>
                ) : null}
              </div>

              <div className="row">
                <input
                  className="field"
                  placeholder="Provider address, e.g. http://127.0.0.1:11434/v1"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  style={{ flex: 1, minWidth: "18rem" }}
                />
                <input
                  className="field"
                  placeholder="Model name"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  style={{ flex: 1, minWidth: "10rem" }}
                />
                <button className="btn" type="button" onClick={() => void saveProvider()}>
                  {systemInUse ? "Save and use my provider" : "Save profile"}
                </button>
              </div>

              <div className="row">
                <input
                  className="field"
                  type="password"
                  placeholder={provider.hasKey ? "A key is stored — type a new one to replace it" : "Paste the key"}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  style={{ flex: 1, minWidth: "16rem" }}
                  autoComplete="off"
                />
                <button className="btn" type="button" onClick={() => void saveKey()} disabled={key.length === 0}>
                  Store the key
                </button>
                <button className="btn" type="button" onClick={() => void clearKey()} disabled={!provider.hasKey}>
                  Remove the key
                </button>
              </div>

              {provider.swappedForWsl ? (
                <p className="muted" style={{ margin: 0 }}>
                  This machine runs inside WSL, so a loopback address is swapped for the Windows host address on each
                  call.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "prompts" ? (
        <div className="card">
          {log.length === 0 ? (
            <p className="muted">Nothing has been sent to a provider yet.</p>
          ) : (
            <div className="stack scroll-area">
              {log.map((entry, position) => (
                <details className="disclosure" key={`${entry.at}-${position}`}>
                  <summary>
                    {entry.kind === "generation" ? "Card generation" : "Hint"} ·{" "}
                    {new Date(entry.at).toLocaleString()} · {entry.model ?? "unknown model"}
                  </summary>
                  <pre className="code-block">{entry.prompt}</pre>
                </details>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "data" ? (
        <div>
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              Cards and record: {folders.data}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Packs: {folders.packs}
            </p>
          </div>

          <div className="card">
            <p style={{ margin: 0 }}>
              Last planner run: <strong>{settings.algorithm.lastAlgorithm}</strong>
              {settings.algorithm.lastAlgorithm === "fallback" ? " (the simple spread, because the usual one stumbled)" : ""}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Fallbacks so far: {settings.algorithm.fallbackCount}
              {settings.algorithm.lastFallbackAt ? ` · last one ${new Date(settings.algorithm.lastFallbackAt).toLocaleDateString()}` : ""}
            </p>
          </div>

          <div className="card stack">
            <h2>Autosave</h2>
            {auto.supported ? (
              auto.fileName ? (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    Connected to <strong>{auto.fileName}</strong>. Every change rewrites that file after a short pause.
                    The provider key is never included.
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    {auto.lastSavedAt
                      ? `Last written ${new Date(auto.lastSavedAt).toLocaleString()}.`
                      : "Nothing has been written yet."}
                  </p>
                  {auto.permission && auto.permission !== "granted" ? (
                    <p className="muted" style={{ margin: 0 }}>
                      This browser needs your permission again before it can rewrite the file.
                    </p>
                  ) : null}
                  <div className="row">
                    <button className="btn small" type="button" onClick={() => void saveAutoNow()}>
                      Save the backup now
                    </button>
                    <button className="btn small" type="button" onClick={() => void chooseAutoFile()}>
                      {auto.permission && auto.permission !== "granted" ? "Reconnect the file" : "Choose another file"}
                    </button>
                    <button className="btn small" type="button" onClick={() => void stopAuto()}>
                      Stop autosave
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    Choose one backup file. Every change rewrites it, so the file is always current. The provider key is
                    never included.
                  </p>
                  <div className="row">
                    <button className="btn" type="button" onClick={() => void chooseAutoFile()}>
                      Choose a backup file
                    </button>
                  </div>
                </>
              )
            ) : (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  This browser cannot rewrite a file by itself. On this device, use Download a backup now.
                </p>
                <div className="row">
                  <button className="btn" type="button" onClick={() => void exportBackup()}>
                    Save a backup now
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="card stack">
            <h2>Backup</h2>
            <p className="muted" style={{ margin: 0 }}>
              A backup holds packs, cards, the record, sessions, settings, the prompt log and any pictures or videos on
              cards. The provider key and subscription pass are never included. It downloads as a zip; restoring
              replaces everything here and both stay in this browser.
            </p>
            <div className="row">
              <button className="btn" type="button" onClick={() => void exportBackup()}>
                Download a backup
              </button>
              <label className="btn">
                Restore from a file
                <input
                  type="file"
                  accept=".zip,.json,application/zip,application/json"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void restoreFromFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              An older JSON backup can still be pasted below.
            </p>
            <textarea
              className="answer-input"
              rows={5}
              placeholder="Paste a backup here to restore it"
              value={backupText}
              onChange={(event) => setBackupText(event.target.value)}
            />
            <div>
              <button className="btn" type="button" onClick={() => void restoreBackup()} disabled={!backupText.trim()}>
                Restore this backup
              </button>
            </div>
          </div>

          <p className="muted">App version {version}.</p>
        </div>
      ) : null}
    </div>
  );
}
