"use client";

// WHY: A paid pass lives in one browser only, so clearing data or moving to a
// new device loses the subscription. This form asks the inbox for it back:
// Stripe is the record, the link is the proof, and the answer never reveals
// whether an address is a subscriber.
// PACK: subscription-recovery
// 2026-10-28 qoder: created for the paid pass recovery. [pack: subscription-recovery]

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSystemConfig,
  RECOVERY_ANSWER,
  requestRecovery,
  systemEnabled,
} from "@/lib/client/system";

/** A sentence from any thrown value, preferring the service's own words. */
function sentenceOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export default function RecoverySection() {
  const [offered, setOffered] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const mounted = useRef(false);

  // The card above reads the facts for itself; this section only needs the one
  // flag that says the operator has set recovery up.
  useEffect(() => {
    if (!systemEnabled()) return;
    mounted.current = true;
    const pending = Promise.resolve()
      .then(() => fetchSystemConfig())
      .then((facts) => {
        if (mounted.current) setOffered(facts.recovery);
      })
      .catch(() => {
        // An unreachable service is already reported by the system card.
      });
    return () => {
      mounted.current = false;
      void pending;
    };
  }, []);

  const send = useCallback(async () => {
    const address = email.trim();
    if (address.length === 0) {
      setProblem("Enter the email you used at checkout.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await requestRecovery(address);
      setEmail("");
      setSent(true);
    } catch (error) {
      setProblem(sentenceOf(error, "The link could not be sent. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }, [email]);

  if (!offered) return null;

  return (
    <div className="card stack">
      <div>
        <h2 style={{ margin: 0 }}>Restore a subscription</h2>
        <p className="muted" style={{ margin: 0 }}>
          The pass lives in one browser only. On a new browser, or after clearing data, ask for a
          link by email and it brings the subscription back here.
        </p>
      </div>

      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-label="The email you used at checkout"
          placeholder="The email you used at checkout"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{ flex: 1, minWidth: "16rem" }}
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a link"}
        </button>
      </form>

      {sent ? (
        <p className="muted" style={{ margin: 0 }} role="status">
          {RECOVERY_ANSWER}
        </p>
      ) : null}
      {problem ? (
        <div className="notice error" role="status">
          {problem}
        </div>
      ) : null}

      <p className="muted" style={{ margin: 0 }}>
        The service keeps nothing from this request. The link lasts 30 minutes and works once, so
        open it in the browser that needs the pass. It only brings back a subscription that is
        still live.
      </p>
    </div>
  );
}
