// WHY: The builder is an address too, so a pack's pages can be bookmarked.
// Static export needs the search read inside a Suspense boundary.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { Suspense } from "react";
import BuilderClient from "@/app/BuilderClient";

export default function BuilderPage() {
  return (
    <Suspense fallback={<p className="muted">Opening the course builder...</p>}>
      <BuilderClient />
    </Suspense>
  );
}
