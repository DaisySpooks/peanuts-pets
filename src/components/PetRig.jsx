import PetRenderer from './PetRenderer.jsx'
import BettaRig from './BettaRig.jsx'
import TurtleRig from './TurtleRig.jsx'

// Picks the right per-species renderer. Each species has a genuinely
// different rig shape (see BettaRig/TurtleRig comments), so this is a
// selection, not a shared/forced layer format. Axolotl renders through the
// existing, untouched PetRenderer.jsx.
export default function PetRig({ species, ...props }) {
  if (species === 'betta') return <BettaRig {...props} />
  if (species === 'turtle') return <TurtleRig {...props} />
  return <PetRenderer {...props} />
}
