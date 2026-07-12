// Pet assets live under /assets/<species>/<colour>/<layer>.png. This is the
// one place that mapping lives, so the rigs don't each hardcode their own
// folder structure.
//
// New pets get a weighted-random colour rolled once at creation (see
// server/petColours.js) — but the persisted `colour` is always the source
// of truth when present. This map is only a fallback for pets whose
// `colour` hasn't arrived yet (still loading, pre-migration row, etc.), so
// older pets keep rendering instead of resolving to a broken path.
const DEFAULT_PET_COLOURS = {
  axolotl: 'pink',
  turtle: 'green',
  betta: 'blue',
}

export function petAssetPath(species, layer, colour) {
  const resolvedColour = colour || DEFAULT_PET_COLOURS[species]
  return `/assets/${species}/${resolvedColour}/${layer}.png`
}
