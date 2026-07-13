// Single source of truth for affection-level progression. Level is always
// derived from `lifetimeAffection` at read time (see toDisplayPet in
// pets.js) — it is never stored, so this table can change without a
// migration or backfill.
//
// Index i (0-based) holds the cumulative lifetime affection required to
// reach level i + 1.
const LEVEL_THRESHOLDS = [0, 10, 25, 50, 90, 140]

// Beyond the last tabled level, the affection required for the next level
// keeps growing: the gap between levels grows by 10 more each level past
// the table (the level 5 -> 6 gap is 50, so level 6 -> 7 is 60, 7 -> 8 is
// 70, and so on). This closed-form sum avoids looping the increments one
// at a time for very high levels.
const lastTabledDiff =
  LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 2]

// Cumulative lifetime affection required to reach `level` (1-indexed).
// Levels below 1 are treated as level 1 (0 affection required).
export function cumulativeAffectionForLevel(level) {
  if (level <= 1) return 0
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1]

  const levelsPastTable = level - LEVEL_THRESHOLDS.length
  const extra = levelsPastTable * lastTabledDiff + (10 * (levelsPastTable * (levelsPastTable + 1))) / 2
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + extra
}

// Derives the current level and progress toward the next one from a pet's
// `lifetimeAffection`. Never mutates or persists anything — purely a
// function of the number passed in.
export function getAffectionLevelInfo(lifetimeAffection) {
  const affection = Number.isFinite(lifetimeAffection) ? Math.max(0, Math.trunc(lifetimeAffection)) : 0

  let level = 1
  while (cumulativeAffectionForLevel(level + 1) <= affection) {
    level += 1
  }

  const currentLevelAt = cumulativeAffectionForLevel(level)
  const nextLevelAt = cumulativeAffectionForLevel(level + 1)

  return {
    level,
    levelProgress: affection - currentLevelAt,
    levelProgressRequired: nextLevelAt - currentLevelAt,
    nextLevelAt,
  }
}
