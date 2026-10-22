// WHY: A learner can make a deck by typing its name, while a provider or chat
// can make a pack or deck by choosing its own name. Both paths need one place
// that turns a name into the existing slug shape and that appends 2, 3, ... on
// a generated collision, so the bundle format and the visible identity cannot
// drift.
// PACK: library-create-flow
// 2026-10-21 opencode: created for the target-first Create flow.

/** A deck as the identity helpers need it: a stable id and a learner label. */
export interface NamedDeck {
  id: string;
  name: string;
}

/** Make the existing lowercase, number and dash shape from a label. */
export function slugFromName(value: string, fallback = "item"): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/** The first free pack name: the base, then base-2, base-3, and so on. */
export function uniquePackName(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  let suffix = 1;
  let candidate = base;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/** The first free deck id and matching label, kept paired on a collision. */
export function uniqueDeckIdentity(
  baseId: string,
  baseName: string,
  existing: Iterable<NamedDeck>,
): NamedDeck {
  const taken = [...existing];
  let suffix = 1;
  let id = baseId;
  let name = baseName;
  while (taken.some((deck) => deck.id === id || deck.name === name)) {
    suffix += 1;
    id = `${baseId}-${suffix}`;
    name = `${baseName} ${suffix}`;
  }
  return { id, name };
}
