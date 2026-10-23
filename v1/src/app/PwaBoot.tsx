"use client";

// WHY: A static export has no server to serve a fallback. The service worker is
// the only thing that can open the app when the network is gone, so it is
// registered once from the shell and only in a production build.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

import { useEffect } from "react";
import { withBasePath } from "@/lib/shared/paths";

export default function PwaBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register(withBasePath("/sw.js"), { scope: withBasePath("/") })
        .catch(() => {
          // A blocked worker must not stop the app from working online.
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
