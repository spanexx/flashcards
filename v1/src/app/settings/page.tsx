// WHY: Settings is where the learner's categories, their provider and the
// quiet algorithm receipt live. The key only ever goes in, never comes out.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import SettingsClient from "@/app/settings/SettingsClient";

export default function SettingsPage() {
  return <SettingsClient />;
}
