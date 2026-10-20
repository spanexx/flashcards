**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline (browser build)
**Blocks:** -
**Blocked by:** - (shape locked by [What owns the data](browser-owned-packs.md), resolved 2026-10-20)

# The authoring skill: a copyable prompt for packs, decks and cards

## Question

Learners without a provider (or without a file picker) must be able to create
content by pasting a prompt into a browser chat, such as ChatGPT, and bringing
the answer back as the same JSON the app imports. Decide: the prompt text and
the rules it states; how it is tailored to the target (a whole new pack, decks
into an existing pack, cards into an existing deck); where it lives in the app
and how it is copied or downloaded; how it stays in step with the schema; and
what the app says when the returned JSON is refused.

## Notes

- Output shape is the same pack bundle locked in What owns the data: pack,
  decks, cards, optional prompts.
- The app fills the prompt with the target pack's real deck names and ids, so
  the answer references real containers.
- This is the no-provider lane; it must work with every generation feature off.

## Resolution

1. **What it is.** A versioned Markdown prompt the learner copies into a browser
   chat (ChatGPT or similar). The chat's reply is JSON the learner pastes or
   loads back into the app.
2. **Three targets.** A whole new pack, decks into a pack the learner picks, or
   cards into a deck the learner picks. The app fills the prompt with that
   target's real pack and deck names and ids, so the answer references real
   containers.
3. **What the prompt says.** The pack bundle shape in plain words; the hard
   rules (at least one deck; every card names exactly one deck; deck ids stay
   stable; no invented card ids; the origin note is "Imported by the learner.");
   one compact worked example; and an instruction to answer with JSON only, no
   commentary and no code fences.
4. **The return path.** JSON only, pasted or loaded as a file. The same
   all-or-nothing validator as import; nothing saves until the whole bundle
   passes, and a refusal names the offending item and field.
5. **Where it lives.** A "Create with a chat" panel beside import and create in
   the Library: target picker, Copy prompt, Download .md, paste box, file
   picker, and three plain steps. No provider is needed to use it.
6. **Staying in step.** The template lives in the repo with the schema version
   embedded; a golden test fails when the prompt and the validator disagree.

## Why

Some learners cannot or will not pay for a provider, and some cannot use a file
picker. A copyable prompt turns any browser chat into the pack author, and one
validated bundle keeps the result inside the same rules as every other import.

**Source:** learner conversation, 2026-10-20.
