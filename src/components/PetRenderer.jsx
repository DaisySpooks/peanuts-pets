import { useEffect, useRef, useState } from 'react'

// Renders the layered axolotl. Swap this component's internals for a PixiJS
// sprite pipeline later — TankStage, TankDecor, TankEffects, StatBar,
// and ActionCard never import from or depend on this file's internals.

// Back-to-front stacking order, minus the swappable eyes/mouth layers.
const BASE_LAYERS = [
  'leg-back-left',
  'leg-front-left',
  'tail',
  'body',
  'leg-back-right',
  'leg-front-right',
  'gills-left',
  'head',
  'gills-right',
]

const SLEEPY_HAPPINESS_THRESHOLD = 30
const HAPPY_HAPPINESS_THRESHOLD = 85

// isEating/isPlaying are transient action feedback owned by the caller;
// they override the mood/happiness face while active. canBlink is only
// true for the normal/happy eyes-open states — sleepy is already closed,
// and eating keeps eyes-open but shouldn't blink mid-bite.
function getAxolotlFaceState(mood, stats, isEating, isPlaying) {
  if (isEating) return { eyes: 'eyes-open', mouth: 'mouth-eating', canBlink: false }
  if (isPlaying) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

  const happiness = typeof stats.happiness === 'number' ? stats.happiness : null
  const isSleepy = mood === 'sleepy' || mood === 'tired' || mood === 'resting'
    || (happiness !== null && happiness <= SLEEPY_HAPPINESS_THRESHOLD)
  if (isSleepy) return { eyes: 'eyes-closed', mouth: 'mouth-sleepy', canBlink: false }

  const isHappy = mood === 'happy' && happiness !== null && happiness >= HAPPY_HAPPINESS_THRESHOLD
  if (isHappy) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

  return { eyes: 'eyes-open', mouth: 'mouth-idle', canBlink: true }
}

const BLINK_MIN_INTERVAL_MS = 3000
const BLINK_MAX_INTERVAL_MS = 6000
const BLINK_MIN_DURATION_MS = 120
const BLINK_MAX_DURATION_MS = 180

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

// Schedules an occasional blink (closed eyes for ~120-180ms) on a
// randomized 3-6s interval whenever blinking is currently allowed.
function useIdleBlink(canBlink) {
  const [isBlinking, setIsBlinking] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!canBlink) {
      setIsBlinking(false)
      return undefined
    }

    const scheduleNextBlink = () => {
      timeoutRef.current = setTimeout(() => {
        setIsBlinking(true)
        timeoutRef.current = setTimeout(() => {
          setIsBlinking(false)
          scheduleNextBlink()
        }, randomBetween(BLINK_MIN_DURATION_MS, BLINK_MAX_DURATION_MS))
      }, randomBetween(BLINK_MIN_INTERVAL_MS, BLINK_MAX_INTERVAL_MS))
    }

    scheduleNextBlink()
    return () => clearTimeout(timeoutRef.current)
  }, [canBlink])

  return isBlinking
}

// Small hearts float up near the head while isPlaying is true — display
// only, positions are percentages within the pet's own aspect box.
const PLAY_HEARTS = [
  { left: '12%', top: '10%', delayMs: 0, sizePx: 11 },
  { left: '30%', top: '4%', delayMs: 150, sizePx: 9 },
  { left: '46%', top: '14%', delayMs: 300, sizePx: 8 },
  { left: '22%', top: '22%', delayMs: 220, sizePx: 7 },
]

export default function PetRenderer({ mood = 'happy', stats = {}, isEating = false, isFeeding = false, feedTrigger = 0, isPlaying = false }) {
  const bob = mood === 'happy' ? 'animate-pet-bob' : ''
  const face = getAxolotlFaceState(mood, stats, isEating, isPlaying)
  const isBlinking = useIdleBlink(face.canBlink)
  const eyes = isBlinking ? 'eyes-closed' : face.eyes
  const layers = [...BASE_LAYERS, eyes, face.mouth]

  return (
    <div
      className={`absolute left-1/2 top-[54%] w-[clamp(4.75rem,26%,6.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)] ${bob}`}
      role="img"
      aria-label={`Mochi the axolotl, mood: ${mood}`}
    >
      <div className="relative aspect-[503/410] w-full drop-shadow-lg">
        {layers.map((layer, index) => {
          const anim = layer === 'tail'
            ? { className: ' animate-tail-sway', style: { transformOrigin: '61% 54%' } }
            : layer === 'gills-left'
            ? { className: ' animate-gill-drift-left', style: { transformOrigin: '25% 37%' } }
            : layer === 'gills-right'
            ? { className: ' animate-gill-drift-right', style: { transformOrigin: '42% 64%' } }
            : layer === 'leg-back-left'
            ? { className: ' animate-limb-float-back-left', style: { transformOrigin: '51% 62%' } }
            : layer === 'leg-front-left'
            ? { className: ' animate-limb-float-front-left', style: { transformOrigin: '26% 61%' } }
            : layer === 'leg-back-right'
            ? { className: ' animate-limb-float-back-right', style: { transformOrigin: '68% 60%' } }
            : layer === 'leg-front-right'
            ? { className: ' animate-limb-float-front-right', style: { transformOrigin: '46% 62%' } }
            : { className: '', style: {} }

          return (
            <img
              key={layer}
              src={`/assets/axolotl/${layer}.png`}
              alt=""
              className={`absolute inset-0 h-full w-full${anim.className}`}
              style={{ zIndex: index, ...anim.style }}
            />
          )
        })}
        {isFeeding && (
          <img
            key={feedTrigger}
            src="/assets/food/food-pellet.png"
            alt=""
            className="pointer-events-none absolute aspect-square w-[14%] animate-pellet-drop"
            style={{ zIndex: layers.length }}
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
