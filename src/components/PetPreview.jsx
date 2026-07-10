// Static, non-animated preview stacks for the Create Pet selection cards.
// Deliberately separate from PetRenderer.jsx, which is the animated,
// mood/stats-driven habitat rig for the axolotl only — this component never
// touches that file or its assets' behavior.
//
// Each species has a different rig shape, so layers are NOT shared:
// - axolotl / betta: split-face rigs — a plain `head` base with separate
//   eyes/mouth layers on top.
// - turtle: full-face expression swaps — there is no neutral head-base +
//   overlay pattern; `face-idle.png` is the complete face and is the only
//   face layer that exists.
// Only files that actually exist in public/assets/<species>/ are listed
// below — e.g. turtle has no flipper-back-left.png, so it is omitted
// rather than invented.
const LAYER_STACKS = {
  axolotl: [
    'leg-back-left',
    'leg-front-left',
    'tail',
    'body',
    'leg-back-right',
    'leg-front-right',
    'gills-left',
    'head',
    'gills-right',
    'eyes-open',
    'mouth-idle',
  ],
  betta: [
    'tail',
    'fin-bottom',
    'fin-side-left',
    'body',
    'fin-side-right',
    'fin-front-left',
    'fin-front-right',
    'fin-top',
    'head',
    'eyes-open',
    'mouth-idle',
  ],
  turtle: ['flipper-back-right', 'shell', 'flipper-front-left', 'flipper-front-right', 'head', 'face-idle'],
}

export default function PetPreview({ species }) {
  const layers = LAYER_STACKS[species] || []

  return (
    <div className="relative aspect-square w-full">
      {layers.map((layer, index) => (
        <img
          key={layer}
          src={`/assets/${species}/${layer}.png`}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          style={{ zIndex: index }}
        />
      ))}
    </div>
  )
}
