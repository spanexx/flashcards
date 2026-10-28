"use client";

// WHY: A learner who does not want to own a key can pay for one provider the
// operator runs. This card is the whole learner face of that bargain: what it
// costs, whether the pass is live, where billing lives, and which lane answers.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { useCallback, useEffect, useRef, useState } from "react";
import { apiSend } from "@/lib/client/api";
import {
  completeSystemCheckout,
  fetchSystemConfig,
  licenseNeedsRefresh,
  openSystemPortal,
  readSystemStatus,
  refreshSystemLicense,
  startSystemCheckout,
  systemEnabled,
  systemProviderName,
  type SystemEntitlement,
  type SystemPublicConfig,
} from "@/lib/client/system";
import {
  readSystemLicense,
  writeSystemLicense,
  type StoredSystemLicense,
} from "@/lib/browser/repository";

/** A checkout return read from the address bar once, then handed to this card. */
export type CheckoutReturn = { kind: "success"; sessionId: string } | { kind: "cancel" };

interface SystemProviderCardProps {
  mode: "custom" | "system";
  checkout: CheckoutReturn | null;
  /** A bumped number means the pass changed outside this card, so read again. */
  reloadSignal: number;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onReturnHandled: () => void;
}

/** A date from epoch seconds, in the learner's own format. */
function formatDay(seconds: number | null): string | null {
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : null;
}

/** A sentence from any thrown value, preferring the service's own words. */
function sentenceOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export default function SystemProviderCard({
  mode,
  checkout,
  reloadSignal,
  onChanged,
  onNotice,
  onError,
  onReturnHandled,
}: SystemProviderCardProps) {
  const [config, setConfig] = useState<SystemPublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [license, setLicense] = useState<StoredSystemLicense | null>(null);
  const [entitlement, setEntitlement] = useState<SystemEntitlement | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const handledReturn = useRef(false);

  /** Ask the service whether the stored pass still buys anything. */
  const loadStatus = useCallback(async (stored: StoredSystemLicense | null) => {
    if (!stored) {
      setEntitlement(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const live = await readSystemStatus(stored.license);
      setEntitlement(live);
      setProblem(null);
      // A pass close to its end is renewed quietly, and only while the plan is
      // still live. A refused refresh leaves the working pass alone.
      if ((live.status === "active" || live.status === "trialing") && licenseNeedsRefresh(stored.expiresAt)) {
        try {
          const renewed = await refreshSystemLicense(stored.license);
          const expiresAt = renewed.entitlement.expiresAt * 1000;
          await writeSystemLicense(renewed.license, expiresAt);
          setLicense({ license: renewed.license, expiresAt });
          setEntitlement(renewed.entitlement);
        } catch {
          // The current pass still works until it expires; the next visit retries.
        }
      }
    } catch (error) {
      setEntitlement(null);
      setProblem(sentenceOf(error, "The subscription could not be checked."));
    } finally {
      setChecking(false);
    }
  }, []);

  /** Read the public facts and the pass this browser holds. */
  const loadCard = useCallback(async () => {
    if (!systemEnabled()) return;
    setConfigError(null);
    setChecking(true);
    try {
      const [facts, stored] = await Promise.all([fetchSystemConfig(), readSystemLicense()]);
      setConfig(facts);
      setLicense(stored);
      await loadStatus(stored);
    } catch (error) {
      setConfigError(sentenceOf(error, "The subscription service could not be reached."));
      setChecking(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    if (!systemEnabled()) return;
    const pending = Promise.resolve().then(() => loadCard());
    return () => {
      void pending;
    };
  }, [loadCard, reloadSignal]);

  // A return from Stripe is exchanged for a pass once. The parent clears the
  // query afterwards, so a reload does not exchange the same session again.
  useEffect(() => {
    if (!systemEnabled() || !checkout || handledReturn.current) return;
    handledReturn.current = true;
    const pending = Promise.resolve().then(async () => {
      if (checkout.kind === "cancel") {
        onNotice("Checkout was cancelled. Nothing was charged.");
        onReturnHandled();
        return;
      }
      setBusy("return");
      setProblem(null);
      try {
        const answer = await completeSystemCheckout(checkout.sessionId);
        const expiresAt = answer.entitlement.expiresAt * 1000;
        await writeSystemLicense(answer.license, expiresAt);
        setLicense({ license: answer.license, expiresAt });
        setEntitlement(answer.entitlement);
        await apiSend("/api/settings", "PATCH", { provider: { mode: "system" } });
        onNotice("Your subscription is active. This browser now uses the system provider.");
        await onChanged();
      } catch (error) {
        const sentence = sentenceOf(error, "The checkout could not be confirmed.");
        setProblem(sentence);
        onError(sentence);
      } finally {
        setBusy(null);
        onReturnHandled();
      }
    });
    return () => {
      void pending;
    };
  }, [checkout, onChanged, onError, onNotice, onReturnHandled]);

  const subscribe = useCallback(async () => {
    setBusy("subscribe");
    setProblem(null);
    try {
      const url = await startSystemCheckout();
      window.location.assign(url);
    } catch (error) {
      setProblem(sentenceOf(error, "The checkout could not be started."));
      setBusy(null);
    }
  }, []);

  const manage = useCallback(async () => {
    if (!license) return;
    setBusy("manage");
    setProblem(null);
    try {
      const url = await openSystemPortal(license.license);
      window.location.assign(url);
    } catch (error) {
      setProblem(sentenceOf(error, "The billing portal could not be opened."));
      setBusy(null);
    }
  }, [license]);

  const refreshPass = useCallback(async () => {
    if (!license) return;
    setBusy("refresh");
    setProblem(null);
    try {
      const renewed = await refreshSystemLicense(license.license);
      const expiresAt = renewed.entitlement.expiresAt * 1000;
      await writeSystemLicense(renewed.license, expiresAt);
      setLicense({ license: renewed.license, expiresAt });
      setEntitlement(renewed.entitlement);
      onNotice("The subscription pass was refreshed.");
    } catch (error) {
      setProblem(sentenceOf(error, "The pass could not be refreshed."));
    } finally {
      setBusy(null);
    }
  }, [license, onNotice]);

  const chooseMode = useCallback(
    async (next: "custom" | "system") => {
      setBusy(next);
      setProblem(null);
      try {
        await apiSend("/api/settings", "PATCH", { provider: { mode: next } });
        onNotice(
          next === "system" ? "The system provider is now in use." : "Your own provider is now in use.",
        );
        await onChanged();
      } catch (error) {
        setProblem(sentenceOf(error, "The provider could not be changed."));
      } finally {
        setBusy(null);
      }
    },
    [onChanged, onNotice],
  );

  if (!systemEnabled()) return null;

  const active = entitlement !== null && (entitlement.status === "active" || entitlement.status === "trialing");
  const renews = formatDay(entitlement?.renewsAt ?? null);
  const stateLabel = checking
    ? "Checking"
    : configError
      ? "Unreachable"
      : active
        ? "Active"
        : license
          ? "Not active"
          : "Not subscribed";
  const name = systemProviderName();

  return (
    <div className="card stack system-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {config?.priceLabel ? config.priceLabel : "A paid provider run by the site owner."}
          </p>
        </div>
        <span className={`status-pill ${active ? "ready" : stateLabel === "Not subscribed" ? "waiting" : ""}`}>
          {stateLabel}
        </span>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        The operator&rsquo;s key stays on the subscription service. This browser holds only a subscription pass, and a
        backup never includes it.
      </p>

      {configError ? (
        <div className="notice error" role="status">
          {configError}
        </div>
      ) : null}
      {problem && problem !== configError ? (
        <div className="notice error" role="status">
          {problem}
        </div>
      ) : null}

      {active ? (
        <p style={{ margin: 0 }}>
          {renews ? `Your subscription is active until ${renews}.` : "Your subscription is active."}
          {entitlement?.cancelAtPeriodEnd ? " It will end then." : ""}
        </p>
      ) : license && !checking ? (
        <p className="muted" style={{ margin: 0 }}>
          The subscription is not active. Manage it to fix billing, refresh the pass, or subscribe again.
        </p>
      ) : null}

      {config && !config.checkout ? (
        <p className="muted" style={{ margin: 0 }}>
          Subscriptions are not open yet. The operator can still set this up.
        </p>
      ) : null}
      {config && !config.proxy ? (
        <p className="muted" style={{ margin: 0 }}>
          The service has no provider configured yet, so paid calls will fail until the operator finishes setup.
        </p>
      ) : null}

      <div className="row">
        {license ? (
          <button className="btn primary" type="button" onClick={() => void manage()} disabled={busy !== null}>
            {busy === "manage" ? "Opening…" : "Manage subscription"}
          </button>
        ) : (
          <button
            className="btn primary"
            type="button"
            onClick={() => void subscribe()}
            disabled={busy !== null || config === null || !config.checkout}
          >
            {busy === "subscribe" ? "Opening checkout…" : "Subscribe"}
          </button>
        )}
        {license && !active && !checking ? (
          <button className="btn" type="button" onClick={() => void refreshPass()} disabled={busy !== null}>
            {busy === "refresh" ? "Refreshing…" : "Refresh the pass"}
          </button>
        ) : null}
        {license && !active && config?.checkout ? (
          <button className="btn" type="button" onClick={() => void subscribe()} disabled={busy !== null}>
            {busy === "subscribe" ? "Opening checkout…" : "Subscribe again"}
          </button>
        ) : null}
        {mode === "system" ? (
          <button
            className="btn"
            type="button"
            onClick={() => void chooseMode("custom")}
            disabled={busy !== null}
          >
            {busy === "custom" ? "Switching…" : "Use my own provider"}
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            onClick={() => void chooseMode("system")}
            disabled={busy !== null || !active}
            title={active ? undefined : "Subscribe first, then switch."}
          >
            {busy === "system" ? "Switching…" : "Use the system provider"}
          </button>
        )}
      </div>

      {mode === "system" ? (
        <p className="muted" style={{ margin: 0 }}>
          The system provider is in use, so card generation and hints go through the subscription service.
        </p>
      ) : active ? (
        <p className="muted" style={{ margin: 0 }}>
          Your subscription is active but not in use. Switch to it whenever you like.
        </p>
      ) : null}
    </div>
  );
}
