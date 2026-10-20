# Flash Cards - Agent Guide

## IMPORTANT!!!
**YOU CAN TALK** - just use the `say` skill to communicate with me.

- Prefer plain english less technical words, refer to `plain-english-first` skill.
- Prefer answering questions in chunks, refer to `answer-question` skill.
- Run every git command through WSL Debian.
- **The Dev Lane** - `docs/ethics/dev-lane.md` - read it before running a build, test, or dev server. The browser rebuild lives in `v1/`.

## HOW TO RUN COMMANDS
- **NEVER PUT A SERVER AND A TEST IN ONE COMMAND** - start a server detached, then check its port in a separate step. A server start is not a test.
- **EVERY WAIT MUST BE BOUNDED** - give long commands an explicit timeout. A command that produces no new output is stuck: stop it and inspect the process or port. Do not wait on it again.
- **RUN THE SMALLEST CHECK FIRST** - one targeted check, then the full suite once at the end. When a check passes, stop and report it. Repeating the same check is not verification.
- **CLEAN UP BACKGROUND PROCESSES** - stop test servers and fake providers when the check is done.

## BEFORE YOU COMMIT
- Read `docs/ethics/commit.md`. It is the gate.

## BEFORE YOU WRITE ANY PIECE OF CODE
- **I Only Accept modular Ethics** - `docs/ethics/modular.md`
- **Must Follow Implementation Ethics** - `docs/ethics/implementation.md`
- **Commenting Is Not Optional** - `docs/ethics/commenting.md`
- **Every Piece of Code Has An Origin** - `docs/ethics/origin.md` - it arrives through `feature-pipeline` or `surgical-change`. There is no third way in.
- **ENVIONMENT AGNOSTIC** - Ensure the platform works across all environments. Reassess your previous decisions and revise any that limit cross-environment compatibility.

## DO NOTs
- **DO NOT KISS MY ASS** - Don't be a yes-man. Challenge my bad decisions, flag conflicts with existing decisions, and defend established principles. Prioritize logic over pleasing me. Protect the project, not my ego.
- **DO NOT RESOLVE A TICKET WITHOUT WRITING IT DOWN** - a decision lives in its ticket, and `wayfinder/anything-learning-spec/map.md` is the index, never the store.