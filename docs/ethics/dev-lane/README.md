# Flashcards - Dev Lane

## Start Here
- **Commands** - `commands.md` - detached work, bounded waits, smallest first.
- **Build and test** - `build.md` - WSL build, `out/`, typecheck, lint, tests.
- **Serve** - `serve.md` - static server, Windows reachability gate, cleanup.
- **Environment** - `environment.md` - WSL/Windows paths and networking.
- **Data and provider** - `data.md` - IndexedDB, backup, browser-held key.
- **History** - `history.md` - archived v1 Express lane, deviations, known gaps.

## Current Lane
- `v1` has code. This is the live browser-owned build, not the pre-code placeholder.
- The build is a Next.js static export. `npm run build` writes `out/`; there is
  no runtime server or API route.
- WSL Debian is the build machine. Windows is the host that opens the page.
- The app is a page, not a process. Serve `out/` with any plain file server.
- The app works fully with no provider key.

## Non-Negotiables
- **A WSL server is not up until Windows can reach it.** See `serve.md`.
- **Do not use `nohup`/`setsid` for a host-facing WSL server.** Start it through
  a Windows-side `wsl.exe` process and keep the host-side PID.
- **Do not build on Windows.** The lane is WSL Debian. The old PowerShell
  deviation is history, not a precedent.
- **Do not wrap commands you do not need to wrap.** Inside WSL, run the command.
- **Do not combine a server start with a build, test, or E2E run.**
- **Do not build past a locked decision.** If the code contradicts a ticket, the
  ticket wins and the drift is logged.
- **Do not hardcode a Windows path, drive letter, or user directory.** A thing
  that only runs on one machine is not finished.
