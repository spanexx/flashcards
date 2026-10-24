# Build And Test

## Lane
- Build in WSL Debian. The package root is `v1/`.
- Run npm through WSL, for example:
  `wsl -d Debian --cd <absolute-v1-path> -- npm test`.
- Do not hardcode a Windows path, drive letter, or user directory.
- As of 2026-10-24 this worktree runs its build and tests inside WSL. If a
  checkout still says `Cannot find native binding`, its `node_modules` are
  Windows-native; reinstall inside WSL instead of moving the lane to Windows.

## Build
- `npm run build` writes the static app to `v1/out/`.
- Run the build before any simulation that reads `out/`; an old bundle is not
  evidence for new code.
- The app is a static export. Do not add an API route or a runtime server to
  make a feature work.

## Checks
- `npm run typecheck`
- `npm run lint`
- one targeted test, then the full `npm test` once.
- Report the file and test counts from the full run.

## Browser Target
- Next.js static export, served as plain files.
- IndexedDB holds packs, decks, cards, evidence, sessions, prompts, settings,
  and the provider key.
- Desktop Chrome/Edge can use File System Access for autosave. Phones fall back
  to manual export.
- No new runtime dependency without a locked decision.

## Do Not
- Do not build on Windows. The old PowerShell run is recorded in `history.md`
  as a deviation, not as the lane.
- Do not build past a locked decision. If the code contradicts a ticket, the
  ticket wins and the drift is logged.
