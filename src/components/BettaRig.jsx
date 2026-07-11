import { useEffect, useRef, useState } from 'react'
import { useIdleBlink } from './useIdleBlink.js'

// Betta's split-face rig: a plain `head` base with separate eyes/mouth
// layers on top, same pattern as the axolotl rig — but betta has no
// mouth-sleepy asset, so its sleepy state falls back to the idle mouth
// rather than inventing a file.
//
// Back-to-front stacking order (measured/specified per the actual asset
// bounding boxes, not guessed): the far-side fins sit behind body/head,
// the near-side fins sit in front of them, face layers on top of all.
const BASE_LAYERS = [
  'fin-bottom',
  'fin-front-right',
  'tail',
  'fin-top',
  'fin-side-right',
  'body',
  'head',
  'fin-front-left',
  'fin-side-left',
]

// Idle fin/tail motion. Reuses the existing generic wobble keyframes
// (tail-sway / gill-drift-* / limb-float-*) already registered in
// tailwind.config.js for the axolotl rig — these are generic small
// rotate+translate wobbles, not axolotl-specific in content, so reusing
// them here doesn't require touching the shared config or the axolotl
// file. Transform origins below are measured from each layer's real pixel
// alpha bounds (public/assets/betta/*.png), at the edge where that part
// visually attaches to the body — same convention already used by the
// axolotl rig. Durations/delays are deliberately distinct per fin so
// nothing moves in lockstep.
const FIN_MOTION = {
  tail: { keyframe: 'tail-sway', duration: '3.6s', delay: '0s', origin: '60% 52%' },
  'fin-top': { keyframe: 'limb-float-a', duration: '4.0s', delay: '0.3s', origin: '55% 44%' },
  'fin-bottom': { keyframe: 'limb-float-b', duration: '4.3s', delay: '0.6s', origin: '58% 53%' },
  'fin-side-right': { keyframe: 'gill-drift-right', duration: '4.1s', delay: '0.15s', origin: '24% 60%' },
  'fin-side-left': { keyframe: 'gill-drift-left', duration: '4.5s', delay: '0.9s', origin: '51% 50%' },
  'fin-front-right': { keyframe: 'limb-float-a', duration: '4.2s', delay: '0.5s', origin: '28% 65%' },
  'fin-front-left': { keyframe: 'limb-float-b', duration: '4.6s', delay: '1.1s', origin: '45% 64%' },
}

function finLayerStyle(layer) {
  const motion = FIN_MOTION[layer]
  if (!motion) return {}
  return {
    transformOrigin: motion.origin,
    animation: `${motion.keyframe} ${motion.duration} ease-in-out ${motion.delay} infinite`,
  }
}

const SLEEPY_HAPPINESS_THRESHOLD = 30
const HAPPY_HAPPINESS_THRESHOLD = 85

// Feed/eating timing for all pets lives in HabitatScreen.jsx
// (PELLET_DURATION_MS / EATING_START_MS / EATING_END_MS) and is unchanged.
// This just holds betta's own mouth-eating a little longer than the raw
// `isEating` prop so it stays open through the pellet's arrival and closes
// shortly after, instead of snapping shut exactly when the shared timer
// flips — local to this rig only.
const EATING_HOLD_EXTRA_MS = 250
// Shared feed timing starts `isEating` at ~1296ms into the 1800ms feed.
// Betta's pellet path reaches its mouth at the end of that path, so the
// visible shut chomp should start ~504ms after `isEating` turns on.
const CHOMP_TRIGGER_DELAY_MS = 504
const CHOMP_DURATION_MS = 120

function useExtendedEating(isEating) {
  const [held, setHeld] = useState(isEating)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (isEating) {
      clearTimeout(timeoutRef.current)
      setHeld(true)
      return undefined
    }
    timeoutRef.current = setTimeout(() => setHeld(false), EATING_HOLD_EXTRA_MS)
    return () => clearTimeout(timeoutRef.current)
  }, [isEating])

  return held
}

function getBettaFaceState(mood, stats, isEating, isPlaying) {
  if (isEating) return { eyes: 'eyes-open', mouth: 'mouth-eating', canBlink: false }
  if (isPlaying) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

  const happiness = typeof stats.happiness === 'number' ? stats.happiness : null
  const isSleepy = mood === 'sleepy' || mood === 'tired' || mood === 'resting'
    || (happiness !== null && happiness <= SLEEPY_HAPPINESS_THRESHOLD)
  if (isSleepy) return { eyes: 'eyes-closed', mouth: 'mouth-idle', canBlink: false }

  const isHappy = mood === 'happy' && happiness !== null && happiness >= HAPPY_HAPPINESS_THRESHOLD
  if (isHappy) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

  return { eyes: 'eyes-open', mouth: 'mouth-idle', canBlink: true }
}

// Betta-specific food path and play wiggle, scoped entirely to this file via
// an inline <style> tag rather than the shared `pellet-drop` keyframe in
// tailwind.config.js (which is tuned for the axolotl's mouth and must stay
// untouched for axolotl/turtle). Betta's mouth sits at ~27%,61% of its own
// canvas — measured directly from mouth-idle.png's real alpha bounds — so
// this path ends there instead of reusing axolotl's coordinates.
const BETTA_KEYFRAMES = `
@keyframes betta-pellet-drop {
  0% { left: 20%; top: 8%; opacity: 0; transform: scale(0.5); }
  10% { opacity: 1; transform: scale(1); }
  30% { left: 24%; top: 28%; }
  50% { left: 19%; top: 40%; }
  70% { left: 25%; top: 50%; }
  90% { left: 22%; top: 53%; opacity: 1; }
  100% { left: 20%; top: 58%; opacity: 0; transform: scale(0.4); }
}
@keyframes betta-play-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-1.5%, -1%) rotate(-6deg); }
  45% { transform: translate(1.5%, -1.5%) rotate(5deg); }
  70% { transform: translate(-1%, -0.5%) rotate(-3deg); }
}
`

const PLAY_HEARTS = [
  { left: '12%', top: '10%', delayMs: 0, sizePx: 11 },
  { left: '30%', top: '4%', delayMs: 150, sizePx: 9 },
  { left: '46%', top: '14%', delayMs: 300, sizePx: 8 },
  { left: '22%', top: '22%', delayMs: 220, sizePx: 7 },
]

export default function BettaRig({ mood = 'happy', stats = {}, isEating = false, isFeeding = false, feedTrigger = 0, isPlaying = false, name }) {
  const bob = mood === 'happy' ? 'animate-pet-bob' : ''
  const isEatingHeld = useExtendedEating(isEating)
  const face = getBettaFaceState(mood, stats, isEatingHeld, isPlaying)
  const [isChomping, setIsChomping] = useState(false)
  const chompStartTimeoutRef = useRef(null)
  const chompEndTimeoutRef = useRef(null)
  const isBlinking = useIdleBlink(face.canBlink)

  useEffect(() => {
    if (!isEating) {
      clearTimeout(chompStartTimeoutRef.current)
      clearTimeout(chompEndTimeoutRef.current)
      setIsChomping(false)
      return undefined
    }

    clearTimeout(chompStartTimeoutRef.current)
    clearTimeout(chompEndTimeoutRef.current)
    setIsChomping(false)

    chompStartTimeoutRef.current = setTimeout(() => {
      setIsChomping(true)
      chompEndTimeoutRef.current = setTimeout(() => setIsChomping(false), CHOMP_DURATION_MS)
    }, CHOMP_TRIGGER_DELAY_MS)

    return () => {
      clearTimeout(chompStartTimeoutRef.current)
      clearTimeout(chompEndTimeoutRef.current)
    }
  }, [isEating])

  const eyes = isChomping ? 'eyes-closed' : isBlinking ? 'eyes-closed' : face.eyes
  const mouth = isChomping ? 'mouth-idle' : face.mouth
  const layers = [...BASE_LAYERS, eyes, mouth]

  // Feed: lean gently toward the food, then ease back to neutral. Play: a
  // quick, contained happy wiggle. Both live on this inner wrapper (not the
  // outer pet-bob element) so they never fight with the whole-body float.
  const actionStyle = isFeeding
    ? { transform: 'translate(-3%, -3%) rotate(-4deg)', transition: 'transform 500ms ease-out' }
    : isPlaying
      ? { animation: 'betta-play-wiggle 1.4s ease-in-out 1' }
      : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] w-[clamp(4.75rem,26%,6.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)] ${bob}`}
      role="img"
      aria-label={`${name || 'Your betta'}, mood: ${mood}`}
    >
      <style>{BETTA_KEYFRAMES}</style>
      <div className="relative aspect-[586/488] w-full drop-shadow-lg" style={actionStyle}>
        {layers.map((layer, index) => (
          <img
            key={layer}
            src={`/assets/betta/${layer}.png`}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ zIndex: index, ...finLayerStyle(layer) }}
          />
        ))}
        {isFeeding && (
          <img
            key={feedTrigger}
            src="/assets/food/food-pellet.png"
            alt=""
            className="pointer-events-none absolute aspect-square w-[14%]"
            style={{ zIndex: layers.length, animation: 'betta-pellet-drop 1800ms ease-in-out forwards' }}
          />
        )}
        {isPlaying && PLAY_HEARTS.map((heart, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center leading-none text-cream/90 animate-play-heart"
            style={{
              left: heart.left,
              top: heart.top,
              fontSize: `${heart.sizePx}px`,
              animationDelay: `${heart.delayMs}ms`,
              zIndex: layers.length + 1,
            }}
          >
            ♥
          </span>
        ))}
      </div>
    </div>
  )
}
