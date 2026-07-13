// Single source of truth for temperament stat tendencies (V1). Temperament
// assignment/rerolling/persistence lives in petTemperament.js — this module
// only maps an already-rolled temperament to its gameplay modifiers, so
// every route/service reads the same table instead of duplicating checks.
//
// Missing/invalid temperaments intentionally have no entry here, so every
// lookup below falls back to neutral baseline behaviour (no override, 1x
// decay multiplier, no affection bonus).
const TEMPERAMENT_EFFECTS = {
  playful: {
    actionRestoreOverrides: { play: 30 },
    decayMultipliers: { happiness: 1.1 },
  },
  curious: {
    pettingAffectionBonus: 1,
  },
  gentle: {
    decayMultipliers: { happiness: 0.9 },
  },
  sleepy: {
    decayMultipliers: { happiness: 0.85 },
  },
  foodie: {
    actionRestoreOverrides: { feed: 30 },
    decayMultipliers: { hunger: 1.1 },
  },
}

// Returns the restore amount for a care action (feed/play/clean), applying
// a temperament override when one exists, otherwise the action's normal
// baseline delta.
export function getActionRestoreAmount(temperament, action, baselineDelta) {
  const override = TEMPERAMENT_EFFECTS[temperament]?.actionRestoreOverrides?.[action]
  return override ?? baselineDelta
}

// Returns the passive decay multiplier for a stat (hunger/cleanliness/
// happiness), or 1 (no change) when the temperament has no modifier for
// that stat.
export function getStatDecayMultiplier(temperament, statKey) {
  return TEMPERAMENT_EFFECTS[temperament]?.decayMultipliers?.[statKey] ?? 1
}

// Returns the extra Affection granted on a successful petting interaction
// beyond the normal +1, or 0 when the temperament has no petting bonus.
export function getPettingAffectionBonus(temperament) {
  return TEMPERAMENT_EFFECTS[temperament]?.pettingAffectionBonus ?? 0
}
