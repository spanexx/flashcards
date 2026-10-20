// WHY: Packs declare which app versions they need, so the app needs one
// version number it can compare against. Keeping it here means the pack loader
// and the settings screen never disagree.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

/** The prototype's version. Packs compare their coreRange against this. */
export const APP_VERSION = "0.1.0";
