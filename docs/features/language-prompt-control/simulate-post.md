# Language and prompt control — post-implementation simulation

- Status: passed
- Pack: `language-prompt-control`
- Date: 2026-10-24
- Canonical script: `docs/features/language-prompt-control/simulate.sh`
- Canonical rehearsal: `v1/tests/simulate-language-prompt-control.test.ts`
- Built-output lane: external Edge CDP run, temporary script, not committed

## What the canonical rehearsal proves

The test uses the real browser router and a memory store. It creates an
English/English pack, reads the starter pair, walks a type card and a listening
card, edits and resets a pack, and round-trips export/backup.

1. An English/English pack previews English and contains neither Polish nor the
   Polish sample line.
2. A deck target inherits the starter `pl`/`en` pair, the starter instruction
   and the read-only note.
3. A type card in a pack with no instruction says
   "Read the English line, then type the full Polish line."
4. A listening card exposes the spoken line and its mode label never prints the
   card summary.
5. Editing changes the pair, instruction and prompts; reset leaves the pair and
   instruction in place and clears only the prompt override.
6. Export carries the new fields, an old bundle without them still loads, and
   backup restores the pair, instruction and prompts.
7. The built client contains the reveal, language and editor words.
8. The summary is checked through the study label and the built-output lane.

Run it with:

```bash
bash docs/features/language-prompt-control/simulate.sh
```

`npm run build` must run first because the rehearsal reads `v1/out`.

## Built-output browser lane

The lane opened the static `out` build in headless Edge with a fresh profile and
drove the real screens. It passed:

- Created an empty English/English pack through Create → Write.
- Saw an English prompt with no Polish in an empty library.
- Saw the inherited `pl`/`en` pair and starter instruction as read-only facts on
  Write deck and Write cards, then saw them disabled on a Chat deck target.
- Saw the exact pair-aware type instruction.
- Saw the listening line hidden, pressed "Show the text", and saw the line.
- Started a tutor hint on card A, answered, moved to card B while the request
  was pending, and saw no hint text, message or busy label on B before or after
  the delayed response arrived.
- Saved a pack instruction and prompt override, reopened the editor, reset the
  prompts, and saw the pair and instruction survive.
- Saw no summary before an answer.

The provider was a delayed fake `fetch`, so the hint race was real without a
network account or a key.

## Observation found and fixed

The browser lane showed that `PackEditor` announced "Saved …", then the Packs
refresh replaced that notice with "The library was refreshed." The save itself
was correct. The editor now refreshes first and announces the save afterward;
the browser lane rechecked both the override and reset notices.

## Drift check reconciliation

A separate docs-to-code audit found four gaps after the first lane. They are
fixed and covered now:

- An English/English pack and a pack with no source use the neutral instruction
  for listening and picks, not the redundant or guessed language name.
- An old pack with no source stays unknown when its editor is opened and saved;
  PATCH no longer turns a blank source into English. A new pack still starts at
  English.
- The brief owns the pair and instruction. A generated pack cannot replace them
  with a provider echo, and a Chat pack receives them even when the pasted answer
  leaves them out.
- The Write deck and Write cards forms show the parent pack's pair and
  instruction as read-only facts, like Generate and Chat already did.

The canonical test now covers the Chat overlay, same-language wording, and a
POST without a source storing English. The browser lane now checks both the
Write deck and Write cards facts. The remaining audit notes are documented
limits, not contradictions: the browser lane is external and temporary, and
bundle import keeps a language name as written while display normalises it.

## Evidence

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build`: passed (`53 files`, `51 precache entries`)
- `npm test`: `45 files`, `466 tests` passed
- `bash docs/features/language-prompt-control/simulate.sh`: passed
- Built-output Edge CDP lane: passed (`BROWSER LANE PASSED`)

## Not proven

- A real provider key was not used; the hint lane used a delayed fake response.
- The browser lane used IndexedDB setup for the starter and three study packs.
  Creation and editing still ran through the real screens.
- Export/import/backup were proven through the real router in the canonical
  rehearsal, not by clicking the download control in the browser.
