// Single source of truth for pet colour pools, tier weights, and the
// weighted roll used at pet creation. Mirrors the folder names under
// public/assets/<species>/<colour>/ exactly — these are checked against the
// actual asset directories, not invented.
//
// "pale-white" from the design spec maps to the existing `white` folder —
// there is no separate pale-white asset, so the two are the same colour.
export const SPECIES_COLOUR_POOLS = {
  axolotl: {
    common: ['pink', 'white', 'black'],
    uncommon: ['purple', 'teal', 'blue'],
    rare: ['green'],
  },
  turtle: {
    common: ['green', 'blue', 'coral'],
    uncommon: ['purple', 'hot-pink', 'black'],
    rare: ['white'],
  },
  betta: {
    common: ['blue', 'red', 'teal'],
    uncommon: ['green', 'pink', 'yellow'],
    rare: ['purple'],
  },
}

// Orange exists as an asset folder for every species but is deliberately
// excluded from every pool above — reserved for a future limited-time
// Nutshell release. It must never be reachable through rollColourForSpecies,
// only through the admin-only colour override.
const ORANGE = 'orange'

const TIER_WEIGHTS = { common: 0.65, uncommon: 0.30, rare: 0.05 }
const TIERS = ['common', 'uncommon', 'rare']

// Used only as a fallback for pre-migration rows or a still-missing colour
// column — never used for the actual weighted roll at creation time.
export const FALLBACK_DEFAULT_COLOUR = {
  axolotl: 'pink',
  turtle: 'green',
  betta: 'blue',
}

// Rolls a colour for a brand-new pet: first picks a tier by weight
// (65/30/5), then picks evenly among that tier's colours. Two independent
// random draws keep "even within tier" exact regardless of how many
// colours a tier has. Server-side only — call once, at creation, and
// persist the result; never call this to re-derive an existing pet's colour.
export function rollColourForSpecies(species, randomFn = Math.random) {
  const pools = SPECIES_COLOUR_POOLS[species]
  if (!pools) return null

  const tierRoll = randomFn()
  let cumulative = 0
  let chosenTier = TIERS[TIERS.length - 1]
  for (const tier of TIERS) {
    cumulative += TIER_WEIGHTS[tier]
    if (tierRoll < cumulative) {
      chosenTier = tier
      break
    }
  }

  const colours = pools[chosenTier]
  const index = Math.min(Math.floor(randomFn() * colours.length), colours.length - 1)
  return colours[index]
}

// Admin-only: every colour a species can display, including orange for
// testing the reserved Nutshell release ahead of time.
export function getAdminSelectableColours(species) {
  const pools = SPECIES_COLOUR_POOLS[species]
  if (!pools) return []
  return [...pools.common, ...pools.uncommon, ...pools.rare, ORANGE]
}

// Player-facing creation never allows orange; the admin override does.
export function isValidColourForSpecies(species, colour, { allowOrange = false } = {}) {
  if (typeof colour !== 'string') return false
  const pools = SPECIES_COLOUR_POOLS[species]
  if (!pools) return false
  if (colour === ORANGE) return allowOrange
  return pools.common.includes(colour) || pools.uncommon.includes(colour) || pools.rare.includes(colour)
}
