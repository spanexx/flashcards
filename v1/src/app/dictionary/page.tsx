// WHY: The Dictionary reads its place from the address, so one screen serves a
// pack page, a deck page and a card page. Static export needs the search read
// inside a Suspense boundary.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { Suspense } from "react";
import DictionaryClient from "@/app/DictionaryClient";

export default function DictionaryPage() {
  return (
    <Suspense fallback={<p className="muted">Opening the dictionary...</p>}>
      <DictionaryClient />
    </Suspense>
  );
}
