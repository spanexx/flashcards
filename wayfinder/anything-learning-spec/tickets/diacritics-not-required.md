**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline (v1-prototype delta)
**Blocks:** -

# What the alphabet requires

## Question

Surfaced while the learner used the built prototype: Polish words typed without
diacritics (ą, ę, ł, ż, ź, ć, ś, ń, ó) were marked wrong even though the
learner had answered correctly. The learner needs the judge to be neutral to
keyboards that cannot type those letters; not every machine or keyboard layout
has them.

Decide what an accepted typed answer requires of the alphabet.

## Resolution

**Loose judging ignores diacritics; exact judging requires them.** The loose
style, which is the default for every pack card that does not opt out, folds
letters before comparing: NFC, then NFD with all combining marks removed, then
a small stroked-letter map (`ł`→`l`, `ø`→`o`, `đ`→`d`, `ß`→`ss`, `æ`→`ae`,
`œ`→`oe`), then the existing case, whitespace and edge-punctuation rules. So
`Dziekuje bardzo`, `dziekuje bardzo` and `Dziękuję bardzo` are the same answer;
so are `jablko` and `jabłko`.

**`exact` stays strict.** A card that asks for exact spelling, such as code,
still requires every character. The app does not fold there.

**The accepted cost, named:** folding treats diacritics as decoration, so a
letter pair such as `z`/`ż` becomes interchangeable in loose cards. For Polish
starter words this is the right trade: a learner blocked by their keyboard would
otherwise be marked wrong for an answer they know. A future pack that needs the
distinction can mark the card `exact` or carry both spellings as expected
answers.

**Hints and corrections follow the same judge.** A folded match is Got it; a
folded near miss is Nearly. The correction buttons do not change.

## Deliberately not done

- No on-screen Polish keyboard or accent picker.
- No per-letter partial credit.
- No change to the `exact` style and no change to what evidence rows store.
- No language-specific rules beyond the one folding pass; the map is generic.

## Why

The learner's keyboard is not the lesson. Requiring diacritics tests typing
hardware, not Polish. Folding in the loose style also keeps the default judge
honest for every pack: the app never assumes a particular alphabet can be typed.

## Source

Learner review of the running v1 prototype, 2026-10-19 (spoken feedback during
the first browser session); decision confirmed in GRILL Round 2 U2. Code:
`v1/src/lib/core/normalize.ts`.
