# Data And Provider

## IndexedDB
- Packs, decks, cards, evidence, sessions, prompts, settings, and the provider
  key live in the learner's browser.
- There is no server-side store and no account.

## Bundle And Backup
- One JSON bundle format, `flashcards.pack/v1`, covers create, import, and
  export.
- A full backup, `flashcards.backup/v1`, includes everything except the key.
- Restoring replaces the library and keeps the key.
- The Polish starter is a static seed asset made by
  `v1/scripts/make-seed.mjs`.

## Provider Key
- The key is stored in IndexedDB and sent straight to the provider from the
  page. There is no relay and no server holding it.
- Some providers refuse browser calls (CORS). The app says so plainly; it does
  not hide behind a proxy.
- No provider key still means a fully usable app: packs, cards, judging, and
  the learner's own record all work.
- Provider calls are the only network calls: no telemetry, no updates, no
  runtime asset fetches.
