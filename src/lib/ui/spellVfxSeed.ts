export interface SpellVfxRandom {
  readonly seed: number;
  readonly next: () => number;
  readonly between: (min: number, max: number) => number;
  readonly pick: <T>(values: readonly T[]) => T;
}

export const hashStringToSeed = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createSpellVfxRandom = (spellHash: string): SpellVfxRandom => {
  let state = hashStringToSeed(spellHash || "unknown-spell");

  const next = () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed: state,
    next,
    between: (min, max) => min + (max - min) * next(),
    pick: (values) => values[Math.floor(next() * values.length) % values.length],
  };
};

