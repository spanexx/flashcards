// WHY: The editor reads its mode from the address. Static export needs that
// search read inside a Suspense boundary, like the Dictionary and Builder pages.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor route. [pack: mode-editor-design]

import { Suspense } from "react";
import ModeEditorPage from "./ModeEditorPage";

export default function ModeEditorRoute() {
  return (
    <Suspense fallback={<p className="muted">Opening the mode editor...</p>}>
      <ModeEditorPage />
    </Suspense>
  );
}
