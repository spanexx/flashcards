// WHY: A pack is data, so the loader's job is to say whether a folder is a
// pack and, when it is not, to say plainly what is wrong. This shape is the
// handover between the folder and the rest of the app.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { CardSource } from "@/lib/shared/types";

/** The prompt text a pack ships. The app fills the slots it owns. */
export interface PackPrompts {
  generation: { system: string; template: string };
  tutor?: { system: string; hintTemplate: string };
}

/** A pack that loaded, or a folder that failed with a plain reason. */
export interface PackRecord {
  name: string;
  version: string;
  folder: string;
  description?: string;
  language?: string;
  topics: string[];
  topicLabels: Record<string, string>;
  cards: CardSource[];
  prompts: PackPrompts | null;
  error?: string;
}
