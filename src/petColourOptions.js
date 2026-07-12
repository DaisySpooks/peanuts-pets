// Admin-only: every colour selectable per species, including orange for
// testing the reserved Nutshell release ahead of time.
//
// Mirrors server/petColours.js's SPECIES_COLOUR_POOLS + orange. Duplicated
// here rather than imported because server/ and src/ are separate
// deployables (server/ never ships to the frontend bundle) — same
// duplication already used for petAssetPath.js's default-colour fallback.
// Never used for gameplay or random assignment, only to build the admin
// colour-testing selector.
export const ADMIN_SELECTABLE_COLOURS = {
  axolotl: ['pink', 'white', 'black', 'purple', 'teal', 'blue', 'green', 'orange'],
  turtle: ['green', 'blue', 'coral', 'purple', 'hot-pink', 'black', 'white', 'orange'],
  betta: ['blue', 'red', 'teal', 'green', 'pink', 'yellow', 'purple', 'orange'],
}
