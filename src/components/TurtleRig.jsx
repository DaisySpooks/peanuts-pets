import { useEffect, useRef, useState } from 'react'
import { useIdleBlink } from './useIdleBlink.js'

// Turtle's full-face expression-swap rig: there is no neutral head-base +
// separate eyes/mouth overlay pattern here (unlike axolotl/betta) — each
// face-*.png is a complete expression, layered once on top of shell/head.
// Confirmed by diffing face-idle.png against face-eating.png: they differ
// across nearly the whole face bbox, not just a small mouth region, so
// there is no isolated mouth/eye sub-asset to swap independently.
// Only flipper-back-right/-front-left/-front-right exist (no
// flipper-back-left), so that is simply omitted rather than invented.
const BASE_LAYERS = ['flipper-back-right', 'flipper-front-left', 'shell', 'head', 'flipper-front-right']

// Blink: attempted using the same brief flash timing as axolotl/betta
// (useIdleBlink — ~120-180ms, every 3-6s), briefly swapping to
// `face-sleepy` since there is no separate eye layer to blink in
// isolation. This is inherently riskier than a real eyes-open/eyes-closed
// swap: `face-sleepy` is a full alternate expression, not a fast eye-close,
// and it already carries its own meaning as the genuine low-energy state.
// Gated off during eating/play so it can never override those expressions.
// See the report for whether this reads as a blink or too sleepy.

// Gentle flipper motion. Reuses the existing generic wobble keyframes
// (gill-drift-* / limb-float-*, already registered in tailwind.config.js
// for the axolotl rig — generic small rotate+translate wobbles, not
// axolotl-specific in content) with turtle-specific transform origins
// measured from each flipper's real pixel alpha bounds, at the edge where
// it visually attaches to the shell — same convention used for axolotl and
// betta. Shell/head are not animated (no tuned origin would apply to their
// full-body shape). Durations/delays are distinct per flipper so nothing
// moves in lockstep.
const FLIPPER_MOTION = {
  'flipper-back-right': { keyframe: 'gill-drift-right', duration: '4.2s', delay: '0.2s', origin: '72% 58%' },
  'flipper-front-left': { keyframe: 'limb-float-b', duration: '4.0s', delay: '0.5s', origin: '30% 58%' },
  'flipper-front-right': { keyframe: 'limb-float-a', duration: '4.4s', delay: '0.8s', origin: '60% 57%' },
}

function flipperLayerStyle(layer) {
  const motion = FLIPPER_MOTION[layer]
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
// The shared `isEating` signal turns on before the (turtle-specific,
// re-paced) pellet path is actually near the mouth, so this delays
// face-eating's onset by a small local amount to match, and still holds it
// a little past the shared window so it stays visible through arrival and
// closes shortly after — all local to this rig only, same idea as betta's
// hold but with an added onset delay tuned to turtle's own pellet timing.
const EATING_ONSET_DELAY_MS = 320
const EATING_HOLD_EXTRA_MS = 250

function useEatingWindow(isEating) {
  const [held, setHeld] = useState(false)
  const onTimeoutRef = useRef(null)
  const offTimeoutRef = useRef(null)

  useEffect(() => {
    if (isEating) {
      clearTimeout(offTimeoutRef.current)
      onTimeoutRef.current = setTimeout(() => setHeld(true), EATING_ONSET_DELAY_MS)
      return () => clearTimeout(onTimeoutRef.current)
    }
    clearTimeout(onTimeoutRef.current)
    offTimeoutRef.current = setTimeout(() => setHeld(false), EATING_HOLD_EXTRA_MS)
    return () => clearTimeout(offTimeoutRef.current)
  }, [isEating])

  return held
}

function getTurtleFace(mood, stats, isEating, isPlaying) {
  if (isEating) return 'face-eating'
  if (isPlaying) return 'face-happy'

  const happiness = typeof stats.happiness === 'number' ? stats.happiness : null
  const isSleepy = mood === 'sleepy' || mood === 'tired' || mood === 'resting'
    || (happiness !== null && happiness <= SLEEPY_HAPPINESS_THRESHOLD)
  if (isSleepy) return 'face-sleepy'

  const isHappy = mood === 'happy' && happiness !== null && happiness >= HAPPY_HAPPINESS_THRESHOLD
  if (isHappy) return 'face-happy'

  return 'face-idle'
}

// Turtle-specific food path and play bounce, scoped entirely to this file
// via an inline <style> tag rather than the shared `pellet-drop` keyframe
// in tailwind.config.js (tuned for the axolotl's mouth; must stay untouched
// for axolotl/betta). Turtle's mouth is estimated at ~16%,46% of its own
// canvas — face-idle vs face-eating differ across the whole face art (no
// isolated mouth region to measure), so this is an anatomical estimate
// (front/lower part of the face) rather than a pixel-measured target, and
// may need a small follow-up correction once seen rendered.
const TURTLE_KEYFRAMES = `
@keyframes turtle-pellet-drop {
  0% { left: 22%; top: 3%; opacity: 0; transform: scale(0.5); }
  10% { opacity: 1; transform: scale(1); }
  30% { left: 21%; top: 12%; }
  50% { left: 18%; top: 20%; }
  70% { left: 20%; top: 28%; }
  90% { left: 17%; top: 34%; opacity: 1; }
  100% { left: 16%; top: 36%; opacity: 0; transform: scale(0.4); }
}
@keyframes turtle-play-bounce {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(0, -3%) rotate(-3deg); }
  50% { transform: translate(0, 0.5%) rotate(2deg); }
  75% { transform: translate(0, -1.5%) rotate(-1deg); }
}
`

const PLAY_HEARTS = [
  { left: '12%', top: '10%', delayMs: 0, sizePx: 11 },
  { left: '30%', top: '4%', delayMs: 150, sizePx: 9 },
  { left: '46%', top: '14%', delayMs: 300, sizePx: 8 },
  { left: '22%', top: '22%', delayMs: 220, sizePx: 7 },
]

export default function TurtleRig({ mood = 'happy', stats = {}, isEating = false, isFeeding = false, feedTrigger = 0, isPlaying = false, name }) {
  const bob = mood === 'happy' ? 'animate-pet-bob' : ''
  const isEatingHeld = useEatingWindow(isEating)
  const face = getTurtleFace(mood, stats, isEatingHeld, isPlaying)
  // Gated on the whole feed sequence (isFeeding), not just the narrower
  // isEatingHeld window — isEatingHeld now turns on with a delay (see
  // useEatingWindow), which would otherwise leave a gap early in feeding
  // where blink could still fire and interfere.
  const canBlink = !isFeeding && !isPlaying
  const isBlinking = useIdleBlink(canBlink)
  const displayFace = isBlinking ? 'face-sleepy' : face
  const layers = [...BASE_LAYERS, displayFace]

  // Feed: lean gently toward the food, then ease back to neutral. Play: a
  // soft happy paddle/bounce. Both live on this inner wrapper (not the
  // outer pet-bob element) so they never fight with the whole-body float.
  const actionStyle = isFeeding
    ? { transform: 'translate(-3%, -2%) rotate(-3deg)', transition: 'transform 500ms ease-out' }
    : isPlaying
      ? { animation: 'turtle-play-bounce 1.4s ease-in-out 1' }
      : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] w-[clamp(4.75rem,26%,6.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)] ${bob}`}
      role="img"
      aria-label={`${name || 'Your turtle'}, mood: ${mood}`}
    >
      <style>{TURTLE_KEYFRAMES}</style>
      <div className="relative aspect-[503/410] w-full drop-shadow-lg" style={actionStyle}>
        {layers.map((layer, index) => (
          <img
            key={layer}
            src={`/assets/turtle/${layer}.png`}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ zIndex: index, ...flipperLayerStyle(layer) }}
          />
        ))}
        {isFeeding && (
          <img
            key={feedTrigger}
            src="/assets/food/food-pellet.png"
            alt=""
            className="pointer-events-none absolute aspect-square w-[14%]"
            style={{ zIndex: layers.length, animation: 'turtle-pellet-drop 1800ms ease-in-out forwards' }}
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
      {typeof stats.happiness === 'number' && stats.happiness >= 85 && (
        <span aria-hidden="true" className="absolute -top-2 right-2 text-xs text-cream/70">✦</span>
      )}
    </div>
  )
}
