"use client";

// WHY: Autosave is one listener for the whole app, not one per screen. This
// invisible component starts it after the page is interactive.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { useEffect } from "react";
import { startAutosave } from "@/lib/browser/autosave";

export default function AutoSaveBoot() {
  useEffect(() => {
    startAutosave();
  }, []);
  return null;
}
