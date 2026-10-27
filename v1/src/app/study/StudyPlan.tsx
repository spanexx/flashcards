// WHY: The plan is an offer, so the main column reads as one calm line: what is
// laid out, where it came from, the two facts that matter, the scope, one Start
// control and the previous sessions. The material that explains the offer sits
// beside it, and the tutor choice stays reachable without competing with a card.
// PACK: study-tab-redesign, study-sidebar-and-history
// 2026-10-25 opencode: replaced the plan rail with the approved single column
// 2026-10-27 opencode: moved the explanations to the right panel and added the
// previous-sessions list for the study sidebar and history pack
// [pack: study-sidebar-and-history]

import { planHeadline, planLede } from "@/lib/client/study-layout";
import type { PastSession } from "@/lib/core/past-sessions";
import type { PackStatus, Plan } from "@/lib/shared/types";
import PlanAside from "./PlanAside";
import PreviousSessions from "./PreviousSessions";
import ScopePicker from "./ScopePicker";

interface StudyPlanProps {
  plan: Plan;
  packs: PackStatus[];
  past: PastSession[];
  scopePack: string;
  scopeDeck: string;
  offerChoice: number;
  approved: "none" | "yes" | "no";
  onScopeChange: (packName: string, deckId: string) => void;
  onOfferChange: (offer: number) => void;
  onRebuild: () => void;
  onApprove: (next: "yes" | "no") => void;
  onRelearn: (pack: string, deck: string) => void;
  onStart: () => void;
}

/** The plan screen, before a session starts. */
export default function StudyPlan({
  plan,
  packs,
  past,
  scopePack,
  scopeDeck,
  offerChoice,
  approved,
  onScopeChange,
  onOfferChange,
  onRebuild,
  onApprove,
  onRelearn,
  onStart,
}: StudyPlanProps) {
  const banner = plan.banner;
  const selectedPack = packs.find((pack) => pack.name === scopePack) ?? null;
  const selectedDeck = selectedPack?.decks?.find((deck) => deck.id === scopeDeck) ?? null;
  const scopeText = selectedPack
    ? `${selectedPack.name}${selectedDeck ? ` / ${selectedDeck.name}` : ""}`
    : "the whole library";

  return (
    <div className="study-plan-layout">
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

        <PreviousSessions past={past} packs={packs} onRelearn={onRelearn} />
      </div>

      <PlanAside banner={banner} groups={plan.groups} approved={approved} onApprove={onApprove} />
    </div>
  );
}
