// WHY: The plan's secondary material used to sit under it as three stacked
// disclosures. Beside the plan it becomes a quiet tabbed panel; on a phone the
// same tabbed panel opens inside one disclosure so the plan keeps its width.
// PACK: study-sidebar-and-history
// 2026-10-27 opencode: created for the study sidebar and history pack
// [pack: study-sidebar-and-history]
// 2026-10-28 opencode: the phone fold reuses the tabs instead of stacking every
// section, and its body scrolls inside a capped height. [pack: study-sidebar-and-history]

"use client";

import { useState } from "react";
import type { Plan } from "@/lib/shared/types";

type Tab = "tutor" | "expect" | "why";

interface PlanAsideProps {
  banner: Plan["banner"];
  groups: Plan["groups"];
  approved: "none" | "yes" | "no";
  onApprove: (next: "yes" | "no") => void;
}

function TutorSection({ banner, approved, onApprove }: PlanAsideProps) {
  if (!banner || !banner.available) {
    return (
      <p className="muted">No tutor is set up. Hints come from the pack itself, if it ships any.</p>
    );
  }
  return (
    <>
      <h3 className="study-aside-title">The tutor</h3>
      {approved === "none" ? (
        <>
          <p>
            A tutor could help with hints this session, using <strong>{banner.model}</strong> at{" "}
            <strong>{banner.endpoint}</strong>.
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
      {approved === "yes" ? (
        <p className="muted study-tutor-note">The tutor will offer a hint after a missed answer.</p>
      ) : null}
    </>
  );
}

function ExpectSection() {
  return (
    <ul className="study-reasons">
      <li>Hints come from the pack or the tutor.</li>
      <li>A missed card returns once.</li>
      <li>The full line appears after you answer.</li>
    </ul>
  );
}

function WhySection({ groups }: Pick<PlanAsideProps, "groups">) {
  if (groups.length === 0) {
    return <p className="study-reason">Nothing stood out, so the plan takes a fair spread.</p>;
  }
  return (
    <ul className="study-reasons">
      {groups.map((group) => (
        <li key={group.topic}>
          <strong>{group.label}</strong> — {group.reason}{" "}
          <span className="study-reason-count">
            {group.cardIds.length} {group.cardIds.length === 1 ? "card" : "cards"}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface DetailTabsProps {
  idPrefix: string;
  tabs: { id: Tab; label: string }[];
  tab: Tab;
  onTab: (next: Tab) => void;
  sectionProps: PlanAsideProps;
}

/** One tab row and one visible section, shared by the desktop panel and phone fold. */
function DetailTabs({ idPrefix, tabs, tab, onTab, sectionProps }: DetailTabsProps) {
  return (
    <>
      <div className="study-aside-tabs" role="tablist" aria-label="Plan details">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            className={`study-aside-tab${tab === entry.id ? " active" : ""}`}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`${idPrefix}-panel-${entry.id}`}
            onClick={() => onTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="study-aside-body">
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-tutor`}
          aria-labelledby={`${idPrefix}-tab-tutor`}
          hidden={tab !== "tutor"}
        >
          <TutorSection {...sectionProps} />
        </div>
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-expect`}
          aria-labelledby={`${idPrefix}-tab-expect`}
          hidden={tab !== "expect"}
        >
          <ExpectSection />
        </div>
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-why`}
          aria-labelledby={`${idPrefix}-tab-why`}
          hidden={tab !== "why"}
        >
          <WhySection groups={sectionProps.groups} />
        </div>
      </div>
    </>
  );
}

/** The plan's secondary material: one tabbed panel beside the plan or under it. */
export default function PlanAside({ banner, groups, approved, onApprove }: PlanAsideProps) {
  const [tab, setTab] = useState<Tab>("tutor");
  const tutorLabel = banner?.available ? "Tutorial and hints" : "Hints";
  const tabs: { id: Tab; label: string }[] = [
    { id: "tutor", label: tutorLabel },
    { id: "expect", label: "What to expect" },
    { id: "why", label: "Why these cards" },
  ];
  const sectionProps = { banner, groups, approved, onApprove };

  return (
    <>
      <aside className="study-aside" aria-label="Plan details">
        <DetailTabs
          idPrefix="plan-aside"
          tabs={tabs}
          tab={tab}
          onTab={setTab}
          sectionProps={sectionProps}
        />
      </aside>

      <div className="study-fold">
        <details className="study-disclosure study-fold-box">
          <summary>Plan details</summary>
          <div className="study-fold-body">
            <DetailTabs
              idPrefix="plan-fold"
              tabs={tabs}
              tab={tab}
              onTab={setTab}
              sectionProps={sectionProps}
            />
          </div>
        </details>
      </div>
    </>
  );
}
