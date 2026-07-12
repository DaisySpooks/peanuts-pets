// Single source of truth for the temperament pool and the roll used at pet
// creation. Purely cosmetic — no stat modifiers, decay changes, or gameplay
// effects hang off this value anywhere.
export const TEMPERAMENT_POOL = ['playful', 'curious', 'gentle', 'sleepy', 'foodie']

// Equal odds across the whole pool (20% each) — a flat index pick is
// already exactly uniform, so no tiering like colour's rollColourForSpecies.
// Server-side only — call once, at creation, and persist the result; never
// call this to re-derive an existing pet's temperament.
export function rollTemperament(randomFn = Math.random) {
  const index = Math.min(Math.floor(randomFn() * TEMPERAMENT_POOL.length), TEMPERAMENT_POOL.length - 1)
  return TEMPERAMENT_POOL[index]
}

export function isValidTemperament(temperament) {
  return typeof temperament === 'string' && TEMPERAMENT_POOL.includes(temperament)
}
