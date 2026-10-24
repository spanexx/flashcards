# History

This file keeps the archived v1 lane. It is not the current runbook. Start at
`README.md` for the browser rebuild.

## The Lane - v1 (archived)

Written before the first build and superseded on 2026-10-20 by the browser-owned
lane. The stack notes stay here so the prototype's choices are not erased.

### What Still Holds
- Build in WSL Debian; do not hardcode machine paths.
- The app works fully with no provider.
- Provider calls are the only network calls: no telemetry, no runtime assets.

### What The Browser Lane Supersedes
- The local Express process, the Angular front end, and "the key never enters
  the browser" are no longer true. Ticket 16 moved the key and the calls into
  the browser on purpose. The old promise was about a server the learner ran;
  the new lane has no server to hold a key.

### Stack
- **Express + TypeScript** - the local host. It ran on the learner's own machine
  and served the app. It was a **local** server on loopback and nothing else.
- **Angular + TypeScript** - the front end.
- Version one lived in **`v1/`**.

### Where It Ran
- **WSL Debian.** Not Windows. Inside WSL, run the command.
- Nothing hardcoded to a Windows path, a drive letter, or a user directory.

### The Key Never Enters The Browser
- Locked in *How the learner opens the app*, and strict at the time. Every
  provider call was made by the local Express process, which held the key in the
  OS key store. The page sent a prompt to loopback and nothing more.
- No key, no provider call, and no prompt construction in the front end. A build
  where Angular holds the key drifted from a locked decision.

### Local-First, Not Local-Only-Online
- The app must be fully usable with no provider at all. That is locked in T2:
  with no key, the learner still imports decks, studies, and judges.
- Provider calls are the only network calls.
- The learner's data was on disk on the learner's machine. Express held it for
  serving and nothing else.

### Two Environment Facts That Cost Time
- **WSL's `localhost` is not the host's `localhost`.** A provider on Windows at
  `localhost:3001` was unreachable from WSL; the failure looked exactly like a
  dead provider. v1 swapped a loopback provider host for the host address, read
  fresh each start because WSL reassigns it.
- **The build must not sit on the Windows filesystem.** `npm install` into
  `/mnt/c` timed out after eight minutes. It belonged on WSL's own disk. v1
  linked `node_modules` to `/home/spanexx/v1-modules`.

### A Third Fact: Host To Guest Is Broken In Both Directions
- **The host's `localhost` does not always reach WSL either.** A server bound to
  `127.0.0.1` inside WSL was invisible to a Windows browser, even though WSL is
  supposed to forward it. On this machine forwarding stopped after WSL
  renumbered.
- The failure was quiet and misleading: the app logged "is up", answered `200`
  inside WSL, and the browser could not connect.
- v1 resolved it with **`FLASHCARDS_HOST`**, defaulting to `127.0.0.1` so the
  boundary stayed unchanged where forwarding worked. Start it with
  `FLASHCARDS_HOST=0.0.0.0` and open the guest IP instead of localhost:
  `wsl -d Debian -- hostname -I` prints it.
- The guest IP changes between boots. Look it up; never hardcode it.

### The Provider
- Configured in **`v1/.env`**, read at start-up by the local process only:
  `FLASHCARDS_PROVIDER_URL`, `FLASHCARDS_PROVIDER_MODEL`,
  `FLASHCARDS_PROVIDER_KEY`.
- `.env` was gitignored and the key was never sent to the browser.
- The endpoint and model were read at call time, not import time. The `.env`
  file loads after modules are evaluated, so reading the environment once at the
  top captured defaults and silently ignored learner settings.

### Deviation, Recorded Not Hidden
- **v1 was built without the feature pipeline.** On instruction: no PRD, no
  IMPL, no pre-implementation simulation. `origin.md` says there is no third way
  in, so this is a deviation and it is written here rather than hidden.
- What survives: every file carries the ticket it belongs to in its header
  comment, so the trail from a locked decision to the code is still walkable.
- What does not: the pipeline's drift check never ran against a design. The only
  drift check was `v1/smoke.sh`, which walked a whole session and caught two
  real bugs.

### Known Gaps
- **Laya is not TypeScript.** It is a local typed decision engine and v1 does not
  ship it. In v1, judging where a fixed answer set exists is done locally by
  exact match, and the honest fallback is the learner calling it, which is
  already a locked state. This is recorded so the local match is never mistaken
  for Laya itself.
- **The keychain driver did not build here**, so the key fell back to a `0600`
  file in `v1/data/` and the app named which store it used. The browser still
  never held the key, so the locked rule held.
