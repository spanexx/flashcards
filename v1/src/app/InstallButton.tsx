"use client";

// WHY: A PWA needs a visible way in. The browser fires a prompt only when it
// decides the app can be installed; this button uses it when present and gives
// a plain hint when the browser (or an already-installed app) has no prompt.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setHint(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!prompt) {
      setHint((previous) => !previous);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setPrompt(null);
      setHint(true);
    }
  };

  return (
    <div className="install-wrap">
      <button
        className="install-fab"
        type="button"
        aria-label="Install app"
        title="Install app"
        data-install-prompt={prompt ? "ready" : "manual"}
        onClick={() => void install()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2" />
        </svg>
      </button>
      {hint ? (
        <p className="install-hint" role="status">
          Use the browser menu or Share → Add to Home Screen.
        </p>
      ) : null}
    </div>
  );
}
