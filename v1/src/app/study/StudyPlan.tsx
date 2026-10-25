// WHY: The plan is an offer, so it reads as one calm column: what is laid out,
// where it came from, the two facts that matter, the scope, one Start control
// and the reasons folded away. The tutor choice stays reachable without a side
// rail competing with the card.
// PACK: study-tab-redesign
// 2026-10-25 opencode: replaced the plan rail with the approved single column
// [pack: study-tab-redesign]

import { planHeadline, planLede } from "@/lib/client/study-layout";
import type { PackStatus, Plan } from "@/lib/shared/types";
import ScopePicker from "./ScopePicker";

interface StudyPlanProps {
  plan: Plan;
  packs: PackStatus[];
  scopePack: string;
  scopeDeck: string;
  offerChoice: number;
  approved: "none" | "yes" | "no";
  onScopeChange: (packName: string, deckId: string) => void;
  onOfferChange: (offer: number) => void;
  onRebuild: () => void;
  onApprove: (next: "yes" | "no") => void;
  onStart: () => void;
}

/** The plan screen, before a session starts. */
export default function StudyPlan({
  plan,
  packs,
  scopePack,
  scopeDeck,
  offerChoice,
  approved,
  onScopeChange,
  onOfferChange,
  onRebuild,
  onApprove,
  onStart,
}: StudyPlanProps) {
  const banner = plan.banner;
  const selectedPack = packs.find((pack) => pack.name === scopePack) ?? null;
  const selectedDeck = selectedPack?.decks?.find((deck) => deck.id === scopeDeck) ?? null;
  const scopeText = selectedPack
    ? `${selectedPack.name}${selectedDeck ? ` / ${selectedDeck.name}` : ""}`
    : "the whole library";

  return (
    <div className="study-plan">
      <header className="study-plan-head">
        <div>
          <p className="study-eyebrow">Study</p>
          <h1 className="study-display">{planHeadline(plan.cards.length)}</h1>
          <p className="study-lede">{planLede(scopeText)}</p>
        </div>
        <div className="study-facts">
          <span className="study-fact">
            <span className="study-fact-dot" aria-hidden="true" />
            Tutor {approved === "yes" ? "on" : "off"}
          </span>
          <span className="study-fact">No score kept</span>
        </div>
      </header>

      <div className="study-scope-row">
        <ScopePicker packs={packs} packName={scopePack} deckId={scopeDeck} onChange={onScopeChange} />
        <label className="study-scope-field study-offer-field">
          <span>Offer</span>
          <input
            className="field study-offer"
            type="number"
            min={5}
            max={40}
            step={5}
            value={offerChoice}
            onChange={(event) => onOfferChange(Math.max(1, Number(event.target.value) || 5))}
            aria-label="Cards offered"
          />
        </label>
        <button className="study-ghost study-rebuild" type="button" onClick={onRebuild}>
          Rebuild the plan
        </button>
      </div>

      <div className="study-start-row">
        <button
          className="btn primary study-start"
          type="button"
          onClick={onStart}
          disabled={plan.cards.length === 0}
        >
          Start session <span className="study-arrow" aria-hidden="true">→</span>
        </button>
        <p className="study-calm">Stopping is not an ending.</p>
      </div>

      <div className="study-plan-links">
        <details className="study-disclosure">
          <summary>Why these cards</summary>
          {plan.groups.length === 0 ? (
            <p className="study-reason">Nothing stood out, so the plan takes a fair spread.</p>
          ) : (
            <ul className="study-reasons">
              {plan.groups.map((group) => (
                <li key={group.topic}>
                  <strong>{group.label}</strong> — {group.reason}{" "}
                  <span className="study-reason-count">
                    {group.cardIds.length} {group.cardIds.length === 1 ? "card" : "cards"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="study-disclosure">
          <summary>What to expect</summary>
          <ul className="study-reasons">
            <li>Hints come from the pack or the tutor.</li>
            <li>A missed card returns once.</li>
            <li>The full line appears after you answer.</li>
          </ul>
        </details>

        <details className="study-disclosure">
          <summary>{banner?.available ? "The tutor and hints" : "Hints"}</summary>
          {banner && banner.available ? (
            <>
              <h2 className="study-disclosure-title">The tutor</h2>
              {approved === "none" ? (
                <>
                  <p>
                    A tutor could help with hints this session, using <strong>{banner.model}</strong>{" "}
                    at <strong>{banner.endpoint}</strong>.
                  </p>
                  <ul className="study-reasons">
                    <li>It sees {banner.slots.join(", ")}.</li>
                    <li>It never sees what you type.</li>
                  </ul>
                  <details className="study-disclosure study-disclosure-nested">
                    <summary>Show the exact shape of what it would see</summary>
                    <pre className="code-block">{banner.shape}</pre>
                  </details>
                  <div className="row study-tutor-actions">
                    <button className="btn primary" type="button" onClick={() => onApprove("yes")}>
                      Turn the tutor on for this session
                    </button>
                    <button className="btn" type="button" onClick={() => onApprove("no")}>
                      Keep it off
                    </button>
                  </div>
                </>
              ) : approved === "yes" ? (
                <p className="muted">
                  The tutor is on for this session.{" "}
                  <button className="btn small" type="button" onClick={() => onApprove("no")}>
                    Turn it off
                  </button>
                </p>
              ) : (
                <p className="muted">
                  The tutor is off. Hints will come from the pack itself.{" "}
                  <button className="btn small" type="button" onClick={() => onApprove("yes")}>
                    Turn it on
                  </button>
                </p>
              )}
            </>
          ) : (
            <p className="muted">No tutor is set up. Hints come from the pack itself, if it ships any.</p>
          )}
        </details>
      </div>

      {approved === "yes" ? (
        <p className="muted study-tutor-note">The tutor will offer a hint after a missed answer.</p>
      ) : null}
    </div>
  );
}
