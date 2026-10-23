"use client";

// WHY: The page, not the Create panel, owns background work. One boot keeps the
// runner alive while the learner moves between screens.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]

import { useEffect } from "react";
import { startJobRunner } from "@/lib/browser/jobs";

export default function JobsBoot() {
  useEffect(() => {
    startJobRunner();
  }, []);

  return null;
}
