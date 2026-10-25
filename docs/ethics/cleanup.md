# Flashcards - Cleanup Ethics

## The Rule
Every job ends with the bench as clean as you found it. Anything you start or create for a check is your debt: a server, browser lane, watcher, log, screenshot, cache, scratch script or failed download. Pay it before you report done.

## Before You Start
- Put logs and scratch scripts outside the repo, under the system temp folder.
- Write down what you started: name, port, PID and any files you will remove.
- Prefer a command whose output you can poll; bound every wait.

## Before You Finish

### Processes
- Stop every server, fake provider, watcher and headless browser you started.
- Stop a WSL server through its host-side PID; kill the listener if the launcher is gone.
- Confirm the port is closed with `ss -ltnp 'sport = :<port>'` in WSL and a Windows connection check. A closed tab is not a stopped server.
- A port with no listener is the proof.

### Files
- Delete the logs, coverage, screenshots, profiles and scratch scripts you created for the job. A working log belongs under the system temp folder, never in `v1/`.
- Delete generated output and caches when the check is done: `.next/`, `out/`, `coverage/`, `*.tsbuildinfo`, failed archives and editor swap files. They are rebuildable, not evidence.
- Keep only files cited as evidence by a pack that is still open. Once the learner signs off and the pack closes, remove the raw screenshots and scripts too; the report keeps the record.
- Do not hide junk behind `.gitignore`. Ignored is not clean.

### Worktrees And Branches
- A merged feature worktree is cleanup debt. Remove the worktree and delete the local branch once the branch is merged and no longer needed.
- Leave an unmerged branch and its worktree alone unless the learner asks for them to go.

## What You Never Delete Without Permission
- Source, tests, fixtures, docs, simulations, decision reports and `v1/archive/`.
- `v1/.env` or any credential.
- `v1/data/` or any learner data.
- `v1/node_modules/` unless the job is dependency cleanup. Installed packages are state, not output.
- The generated `v1/next-env.d.ts` is kept because TypeScript reads it; it is not scratch.

## Verify
- `git status --short` is clean except intended edits.
- No server, fake provider or debug browser you started remains.
- The ports you used are closed.
- The only ignored files left are the known keepers above and files owned by the learner.

## If You Cannot Clean Up
Say what is still running, where it lives, and why. An honest leftover is safer than a silent one.
