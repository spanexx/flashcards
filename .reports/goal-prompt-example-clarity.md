# Goal: make every authoring example model its own rule

Contract: outcome = no worked example in either prompt lane is underdetermined or looks like a cloze when it is a type card; evidence = targeted tests green, full suite green, build green, both drift gates green; scope = prompt example maps, forms example wording, skill version and pinned tests/docs; authority = delegated by the learner's goal instruction; budget = 3 attempts.

Pipeline: surgical-change under D-49 (opened independently in 2f6efc1)

Worktree: /home/spanexx/.config/superpowers/worktrees/flashcards/fix-prompt-example-clarity

## Iterations

### 1 — 2026-11-22
Action: isolated worktree, split into two investigations, read both reports. Decisions: replace duplicated apple examples with a counted-plural example naming the base word; change the chat forms example to an explicit "Type the changed form of ..." text prompt, not a blank part (judge ignores blank inputs on a type card); leave shipped pack data untouched because changing prompts changes card identity.
Verification: D-49 opened independently -> 2f6efc1; drift 1 open / 48 resolved.
Verdict: pass
Pivot: provider lane has no forms example; only the chat lane needs that edit.
Next: install deps, write red tests, implement.

### 2 — 2026-11-22T06:15
Action: implemented both tasks — counted-plural example in both lanes with `base` field so the word-record lemma stays singular; explicit type prompt for forms plus a no-blank rule in both lanes; skill 8.0.0; tests and docs updated; D-49 resolved.
Verification: targeted tests 54 passed; full suite 91 files / 1130 tests; typecheck clean; changed-file lint clean; build `check-pwa: passed`; drift gates 0 open / 0 awaiting / 49 resolved.
Verdict: pass
Failure class: one test used a cards target without deckId; fixed by naming the deck.
Pivot: `promptLine` intentionally omits blank parts, so the assertion checks text parts plus a real blank-part marker instead.
Next: commit, push, open PR.
