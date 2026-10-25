# Flash Cards - Agent Guide

## IMPORTANT!!!
**YOU CAN TALK** - just use the `say` skill to communicate with me.

- Prefer plain english less technical words, refer to `plain-english-first` skill.
- Prefer answering questions in chunks, refer to `answer-question` skill.
- Run every git command through WSL Debian.
- **The Dev Lane** - `docs/ethics/dev-lane/` - read `README.md` before running a build, test, or dev server. The browser rebuild lives in `v1/`.

## HOW TO RUN COMMANDS
- **NEVER PUT A SERVER AND A TEST IN ONE COMMAND** - start a server detached, then check its port in a separate step. A server start is not a test.
- **A WSL SERVER IS NOT UP UNTIL WINDOWS CAN REACH IT** - start host-facing WSL servers from Windows with `Start-Process wsl.exe ... -PassThru`, bind `0.0.0.0`, then check both `http://localhost:<port>` and `http://<wsl-ip>:<port>` with Windows `curl.exe`. A `200` inside WSL is not evidence. See `docs/ethics/dev-lane/`.
- **NEVER USE `nohup`/`setsid` FOR A HOST-FACING WSL SERVER** - a one-shot WSL shell can leave the process unreachable from Windows even while `ss` shows it listening.
- **EVERY WAIT MUST BE BOUNDED** - give long commands an explicit timeout. A command that produces no new output is stuck: stop it and inspect the process or port. Do not wait on it again.
- **RUN THE SMALLEST CHECK FIRST** - one targeted check, then the full suite once at the end. When a check passes, stop and report it. Repeating the same check is not verification.
- **RUN LONG WORK DETACHED** - start servers, browser lanes, builds and test suites in the background with a log outside the repo; poll the log with a bound.
- **CLEAN UP AFTER YOURSELF** - stop every process you started, close its port, and delete your logs, caches and scratch files. See `docs/ethics/cleanup.md`.

## BEFORE YOU COMMIT
- Read `docs/ethics/commit.md`. It is the gate.
- **Drift Is A Gate** - `docs/ethics/drift.md#three-gates-not-one` - run `npm run check:drift` and `npm run check:drift:staged`; both must pass before you commit. The staged gate refuses a file that an Open or Awaiting entry names.
- **The Hook Enforces Drift** - `docs/ethics/drift.md#turn-the-commit-gate-on` - `.githooks/pre-commit` runs the staged gate. Turn it on once per clone with `git config core.hooksPath .githooks`; the agent must not run that command.
- **Drift Is A Release Gate Too** - `docs/ethics/drift.md#three-gates-not-one` - `npm run check:drift:release` must pass before any tag or deploy; it refuses while any Open or Awaiting entry remains.

## BEFORE YOU FINISH
- Read `docs/ethics/cleanup.md`. Stop every process you started, close its port, delete your logs, caches and scratch files, and leave `git status` showing only intended work.

## BEFORE YOU WRITE ANY PIECE OF CODE
- **I Only Accept modular Ethics** - `docs/ethics/modular.md`
- **Must Follow Implementation Ethics** - `docs/ethics/implementation.md`
- **Commenting Is Not Optional** - `docs/ethics/commenting.md`
- **Every Piece of Code Has An Origin** - `docs/ethics/origin.md` - it arrives through `feature-pipeline` or `surgical-change`. There is no third way in.
- **Drift Is A Gate** - `docs/ethics/drift.md#origin-before-code` - a change needs an origin, and a `surgical-change` cites a D-N that existed before it.
- **ENVIRONMENT AGNOSTIC** - Ensure the platform works across all environments. Reassess your previous decisions and revise any that limit cross-environment compatibility.

## DO NOTs
- **DO NOT KISS MY ASS** - Don't be a yes-man. Challenge my bad decisions, flag conflicts with existing decisions, and defend established principles. Prioritize logic over pleasing me. Protect the project, not my ego.
- **DO NOT RESOLVE A TICKET WITHOUT WRITING IT DOWN** - a decision lives in its ticket, and `wayfinder/anything-learning-spec/map.md` is the index, never the store.