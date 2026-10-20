# Flashcards v1 — browser-owned build

A small flashcard app that runs as a static site in your browser. Packs, cards
and your answer record live in this browser's IndexedDB; nothing is sent to a
server the app owns. A tutor (an OpenAI-compatible provider) is strictly
optional and is called directly from the browser with a key you choose to store.

This is the v1 build described in `docs/features/browser-app/`. It is not
shipped software.

## Requirements

- Node.js 20 or newer to develop and build (tested on Node 24 on Windows and
  Node 20 in WSL Debian)
- A modern browser with IndexedDB for everyday use

## Run it

```
npm install
npm run dev
```

The development server listens on loopback: `http://127.0.0.1:3000`.

To make the static site:

```
npm run build
```

The site is written to `out/`. Serve that folder with any static file server;
routes use a trailing slash (`/library/`) so they work without server rewrites.

## What lives where

| Place | What lives there |
| ----- | ---------------- |
| This browser (IndexedDB) | Packs, cards, your answer record, sessions, settings, the provider key, autosave handle |
| `public/packs/polish-starter.json` | The starter bundle the first visit seeds |
| Your downloads | Pack bundles, backups, and the authoring prompt |

There are no data or pack folders on a server. A backup file is the portable
copy; restoring one replaces the library in this browser and keeps the key.

## Everyday use

1. **Study** — the page shows a plan first, with plain reasons. Answer cards,
   ask for a pack hint, and correct the app if it judged you unfairly.
2. **Library** — create a pack, import a bundle, write a card by hand, generate
   cards from a pack's own prompt, or write a pack with any chat.
3. **Progress** — named cards you can now do, work worth another pass, and an
   evidence drawer per card. Progress is computed fresh; nothing is stored.
4. **Settings** — level, learning style, provider, backup and restore,
   autosave, the algorithm receipt, and the local prompt log.

## The tutor (optional)

The app is fully usable without a provider. To connect one, fill in the
endpoint and model in Settings and store a key in this browser. The key lives
only in IndexedDB and is never shown back to the page, written to a backup, or
sent anywhere except the provider you named.

A prompt is only sent after you have read its exact text and approved it in the
session banner. The browser builds the prompt and calls the provider directly;
some providers refuse browser calls (CORS), in which case the app says so and
the rest keeps working.

## Chat authoring

Library → Create with a chat builds a prompt that names the real pack, version
and deck ids. Copy it into any chat, then paste the answer back or choose the
file it produced. The answer goes through the same bundle checks as a hand
import: one bad card refuses the whole file.

## Commands

| Command                 | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `npm run dev`           | Development server on loopback                      |
| `npm run build`         | Static build in `out/`                              |
| `npm run start`         | Next.js server for the built app                    |
| `npm run typecheck`     | TypeScript, no emit                                 |
| `npm run lint`          | ESLint                                              |
| `npm test`              | Unit tests (vitest)                                 |
| `npm run test:coverage` | Unit tests with coverage thresholds                 |
| `npm run simulate:browser` | The browser contract simulation (needs a build) |

`npm run simulate:browser` checks that `out/index.html` exists, then walks the
contract through the browser modules: seed, create, bundle refusal, duplicate
imports, newer and older versions, plans, hints, backup and restore, authoring,
and the static pages.

## Trust notes

- Answers append to the browser's evidence store; nothing edits or erases an
  earlier row except a correction, which adds a new row.
- The judge runs in the browser. The tutor never sees what you typed — only the
  card's question text, an outcome word, and your level, style and weak topics.
- A bundle is checked whole before anything is saved. A bad file names the item
  and field and changes nothing.
- A backup never contains the provider key. A malformed backup changes nothing.
