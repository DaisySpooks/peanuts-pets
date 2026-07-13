import { useEffect, useRef, useState } from 'react'
import { petAssetPath } from './petAssetPath.js'
import { playPet, playAffection } from '../lib/audio.js'

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
// Feed/eating timing for all pets lives in HabitatScreen.jsx
// (PELLET_DURATION_MS / EATING_START_MS / EATING_END_MS) and is unchanged.
// Shared feed timing starts `isEating` at ~1296ms into the 1800ms feed, and
// axolotl's own pellet-drop keyframe (the reference one in
// tailwind.config.js) reaches the mouth at 1800ms — so the visible shut
// chomp should begin ~504ms after `isEating` turns on (1296ms + 504ms =
// 1800ms total), i.e. at the actual rendered food-contact moment, not the
// instant `isEating` first turns on. Same derivation already used by
// BettaRig/TurtleRig, kept local to this rig only.
const CHOMP_TRIGGER_DELAY_MS = 504
const CHOMP_DURATION_MS = 130
const IDLE_ANIMATION_MIN_INTERVAL_MS = 20000
const IDLE_ANIMATION_MAX_INTERVAL_MS = 40000
const IDLE_HEAD_LIFT_DURATION_MS = 1100
const IDLE_GILL_FLUTTER_DURATION_MS = 950
const PETTING_REACTION_DURATION_MS = 700
const PETTING_COOLDOWN_MS = 12 * 60 * 60 * 1000
const PETTING_INVITE_MIN_INTERVAL_MS = 15000
const PETTING_INVITE_MAX_INTERVAL_MS = 20000
const PETTING_INVITE_DURATION_MS = 1100

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

// Continuous idle loops (body bob, tail/gill sway, limb float) all start at
// animation-delay: 0 by default, so every mount begins perfectly in phase —
// on repeat viewing this reads as a mechanical, animatronic cycle rather
// than a living creature. Each loop gets its own small negative starting
// delay, generated once per mount and held for the component's lifetime, so
// loops appear to already be mid-cycle and never restart in sync with each
// other. Duration/amplitude/keyframes/easing are untouched.
const IDLE_LOOP_DELAY_JITTER_MAX_S = 2

function randomNegativeDelaySeconds(maxSeconds) {
  return -(Math.random() * maxSeconds)
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

// Axolotl-specific play wiggle, scoped entirely to this file via an inline
// <style> tag — same approach BettaRig/TurtleRig use for their own
// betta-play-wiggle/turtle-play-bounce keyframes, kept local rather than
// added to tailwind.config.js since it's specific to this rig's action
// flow. A small, brief body sway (translate/rotate only, no reposition),
// distinct in feel from betta's side-to-side wiggle and turtle's bounce.
const AXOLOTL_KEYFRAMES = `
@keyframes axolotl-play-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-1%, -1%) rotate(-5deg); }
  45% { transform: translate(1%, -1.5%) rotate(4deg); }
  70% { transform: translate(-0.5%, -0.5%) rotate(-2deg); }
}
/* Feed reaction: a brief "notice the food" perk-up (~200ms — inside the
   requested 150-250ms window) before easing into the existing feed lean.
   The 100% keyframe is exactly the old static feed-lean transform, so
   nothing about the held pose itself changes — this only prepends an
   anticipation beat in front of it. animation-fill-mode: forwards holds
   that 100% pose for the rest of the feed action (same as before, just via
   an animation instead of a transition); the moment isFeeding ends, the
   plain neutral transition below takes back over from wherever this left
   off, unchanged. */
@keyframes axolotl-feed-anticipation {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  29% { transform: translate(0, -3%) rotate(-1deg) scale(1.025); }
  100% { transform: translate(-2%, -2%) rotate(-2deg) scale(1); }
}
/* Return-to-idle handoff: when isFeeding ends, this plays instead of
   snapping straight to the plain neutral transition. 0% is exactly the
   held feed-lean pose (the same 100% target as the anticipation keyframe
   above); 100% is neutral. Because this is itself a CSS animation (not a
   transition following a removed animation), the browser never has to
   resolve an in-between "no animation, no transition" frame — there's
   always an animation in control of transform, so the pose can't flash to
   idle before easing starts. */
@keyframes axolotl-feed-release {
  0% { transform: translate(-2%, -2%) rotate(-2deg) scale(1); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-idle-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  38% { transform: translate(0.2%, -1.5%) rotate(-1.6deg); }
  72% { transform: translate(0.1%, -0.4%) rotate(-0.5deg); }
}
@keyframes axolotl-idle-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  30% { transform: translate(0, -0.4%) rotate(-4deg) scale(1.03); }
  60% { transform: translate(0, 0.2%) rotate(2.5deg) scale(1.012); }
}
@keyframes axolotl-petting-lean {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  36% { transform: translate(-1.4%, -1.1%) rotate(-1.8deg) scale(1.012); }
  72% { transform: translate(-0.5%, -0.35%) rotate(-0.6deg) scale(1.004); }
}
@keyframes axolotl-petting-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  34% { transform: translate(-0.25%, -1.8%) rotate(-2.6deg); }
  70% { transform: translate(-0.1%, -0.55%) rotate(-0.8deg); }
}
@keyframes axolotl-petting-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(0, -0.5%) rotate(-5deg) scale(1.045); }
  56% { transform: translate(0, 0.18%) rotate(3deg) scale(1.018); }
}
`

// How long the return-to-idle ease plays after isFeeding ends, before
// falling back to the plain static neutral style. Purely visual — never
// referenced by HabitatScreen's own feed timing/cooldowns.
const FEED_RELEASE_DURATION_MS = 320

// Small hearts float up near the head while isPlaying is true — display
// only, positions are percentages within the pet's own aspect box.
const PLAY_HEARTS = [
  { left: '12%', top: '10%', delayMs: 0, sizePx: 11 },
  { left: '30%', top: '4%', delayMs: 150, sizePx: 9 },
  { left: '46%', top: '14%', delayMs: 300, sizePx: 8 },
  { left: '22%', top: '22%', delayMs: 220, sizePx: 7 },
]

export default function PetRenderer({
  mood = 'happy',
  stats = {},
  lastPettedAt = null,
  isEating = false,
  isFeeding = false,
  feedTrigger = 0,
  isPlaying = false,
  isCleaning = false,
  onPetPersist,
  colour = null,
}) {
  const bob = mood === 'happy' ? 'animate-pet-bob motion-ambient' : ''
  const face = getAxolotlFaceState(mood, stats, isEating, isPlaying)
  const [isChomping, setIsChomping] = useState(false)
  const chompStartTimeoutRef = useRef(null)
  const chompEndTimeoutRef = useRef(null)
  const [isReleasingFeed, setIsReleasingFeed] = useState(false)
  const wasFeedingRef = useRef(isFeeding)
  const releaseTimeoutRef = useRef(null)
  const [idleAnimation, setIdleAnimation] = useState(null)
  const idleScheduleTimeoutRef = useRef(null)
  const idleAnimationTimeoutRef = useRef(null)
  const [showPettingInvite, setShowPettingInvite] = useState(false)
  const [isPetting, setIsPetting] = useState(false)
  const pettingTimeoutRef = useRef(null)
  const pettingInviteScheduleTimeoutRef = useRef(null)
  const pettingInviteVisibleTimeoutRef = useRef(null)
  const petPersistInFlightRef = useRef(false)
  const [optimisticLastPettedAt, setOptimisticLastPettedAt] = useState(null)
  const [pettingAvailabilityNowMs, setPettingAvailabilityNowMs] = useState(() => Date.now())
  const pettingAvailabilityTimeoutRef = useRef(null)
  const idleLoopDelaysRef = useRef(null)
  if (idleLoopDelaysRef.current === null) {
    idleLoopDelaysRef.current = {
      bob: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      tail: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      gillsLeft: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      gillsRight: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      legBackLeft: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      legFrontLeft: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      legBackRight: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      legFrontRight: randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
    }
  }
  const idleLoopDelays = idleLoopDelaysRef.current

  // Detect the falling edge of isFeeding (feeding just ended) and play a
  // brief release animation instead of letting the feed pose disappear and
  // the idle transform appear in the same frame. Purely local, visual-only
  // state — never read by HabitatScreen, never delays onActionPersist.
  useEffect(() => {
    if (wasFeedingRef.current && !isFeeding) {
      setIsReleasingFeed(true)
      clearTimeout(releaseTimeoutRef.current)
      releaseTimeoutRef.current = setTimeout(() => setIsReleasingFeed(false), FEED_RELEASE_DURATION_MS)
    }
    wasFeedingRef.current = isFeeding
  }, [isFeeding])

  useEffect(() => () => clearTimeout(releaseTimeoutRef.current), [])
  useEffect(() => () => clearTimeout(pettingTimeoutRef.current), [])
  useEffect(() => () => {
    clearTimeout(pettingInviteScheduleTimeoutRef.current)
    clearTimeout(pettingInviteVisibleTimeoutRef.current)
  }, [])
  useEffect(() => () => clearTimeout(pettingAvailabilityTimeoutRef.current), [])
  useEffect(() => {
    setOptimisticLastPettedAt(null)
  }, [lastPettedAt])

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

  const happiness = typeof stats.happiness === 'number' ? stats.happiness : null
  const isSleepy = mood === 'sleepy' || mood === 'tired' || mood === 'resting'
    || (happiness !== null && happiness <= SLEEPY_HAPPINESS_THRESHOLD)
  const canIdleAnimate = !isFeeding && !isPlaying && !isCleaning && !isEating && !isReleasingFeed && !isChomping && !isSleepy && !isPetting
  const activeIdleAnimation = canIdleAnimate ? idleAnimation : null
  const effectiveLastPettedAt = optimisticLastPettedAt ?? lastPettedAt
  const lastPettedMs = effectiveLastPettedAt ? new Date(effectiveLastPettedAt).getTime() : Number.NaN
  const isPettingAvailable = !Number.isFinite(lastPettedMs) || (pettingAvailabilityNowMs - lastPettedMs) >= PETTING_COOLDOWN_MS
  const canPet = !isFeeding
    && !isPlaying
    && !isCleaning
    && !isEating
    && !isReleasingFeed
    && !isChomping
    && !isSleepy
    && !activeIdleAnimation
    && !isPetting
    && isPettingAvailable
    && !petPersistInFlightRef.current

  useEffect(() => {
    clearTimeout(pettingAvailabilityTimeoutRef.current)
    setPettingAvailabilityNowMs(Date.now())

    if (!Number.isFinite(lastPettedMs)) return undefined

    const remainingMs = PETTING_COOLDOWN_MS - (Date.now() - lastPettedMs)
    if (remainingMs <= 0) return undefined

    pettingAvailabilityTimeoutRef.current = setTimeout(() => {
      setPettingAvailabilityNowMs(Date.now())
    }, remainingMs)

    return () => clearTimeout(pettingAvailabilityTimeoutRef.current)
  }, [lastPettedMs])

  useEffect(() => {
    clearTimeout(idleScheduleTimeoutRef.current)
    clearTimeout(idleAnimationTimeoutRef.current)

    if (!canIdleAnimate) {
      setIdleAnimation(null)
      return undefined
    }

    const scheduleNextIdleAnimation = () => {
      idleScheduleTimeoutRef.current = setTimeout(() => {
        const nextAnimation = Math.random() < 0.5 ? 'head-lift' : 'gill-flutter'
        const durationMs = nextAnimation === 'head-lift'
          ? IDLE_HEAD_LIFT_DURATION_MS
          : IDLE_GILL_FLUTTER_DURATION_MS

        setIdleAnimation(nextAnimation)
        idleAnimationTimeoutRef.current = setTimeout(() => {
          setIdleAnimation(null)
          scheduleNextIdleAnimation()
        }, durationMs)
      }, randomBetween(IDLE_ANIMATION_MIN_INTERVAL_MS, IDLE_ANIMATION_MAX_INTERVAL_MS))
    }

    scheduleNextIdleAnimation()

    return () => {
      clearTimeout(idleScheduleTimeoutRef.current)
      clearTimeout(idleAnimationTimeoutRef.current)
    }
  }, [canIdleAnimate])

  useEffect(() => {
    clearTimeout(pettingInviteScheduleTimeoutRef.current)
    clearTimeout(pettingInviteVisibleTimeoutRef.current)

    if (!isPettingAvailable || !canPet) {
      setShowPettingInvite(false)
      return undefined
    }

    const scheduleInvite = () => {
      pettingInviteScheduleTimeoutRef.current = setTimeout(() => {
        setShowPettingInvite(true)
        pettingInviteVisibleTimeoutRef.current = setTimeout(() => {
          setShowPettingInvite(false)
          scheduleInvite()
        }, PETTING_INVITE_DURATION_MS)
      }, randomBetween(PETTING_INVITE_MIN_INTERVAL_MS, PETTING_INVITE_MAX_INTERVAL_MS))
    }

    scheduleInvite()

    return () => {
      clearTimeout(pettingInviteScheduleTimeoutRef.current)
      clearTimeout(pettingInviteVisibleTimeoutRef.current)
    }
  }, [canPet, isPettingAvailable])

  const isBlinking = useIdleBlink(face.canBlink && !isCleaning && !isReleasingFeed && !activeIdleAnimation && !isPetting)
  const eyes = isChomping ? 'eyes-closed' : isBlinking ? 'eyes-closed' : face.eyes
  const mouth = isChomping ? 'mouth-idle' : face.mouth
  const pettingEyes = isPetting ? 'eyes-closed' : eyes
  const pettingMouth = isPetting ? 'mouth-happy' : mouth
  const layers = [...BASE_LAYERS, pettingEyes, pettingMouth]

  function getIdleWrapperStyle(layer) {
    if (activeIdleAnimation === 'head-lift' && (layer === 'head' || layer === eyes || layer === mouth)) {
      return {
        transformOrigin: '37% 48%',
        animation: `axolotl-idle-head-lift ${IDLE_HEAD_LIFT_DURATION_MS}ms ease-in-out 1`,
      }
    }

    if (activeIdleAnimation === 'gill-flutter' && (layer === 'gills-left' || layer === 'gills-right')) {
      return {
        transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
        animation: `axolotl-idle-gill-flutter ${IDLE_GILL_FLUTTER_DURATION_MS}ms ease-in-out 1`,
      }
    }

    return { transform: 'translate(0, 0) rotate(0deg)' }
  }

  function getPettingWrapperStyle(layer) {
    if (!isPetting) return { transform: 'translate(0, 0) rotate(0deg)' }

    if (layer === 'head' || layer === pettingEyes || layer === pettingMouth) {
      return {
        transformOrigin: '37% 48%',
        animation: `axolotl-petting-head-lift ${PETTING_REACTION_DURATION_MS}ms ease-out 1`,
      }
    }

    if (layer === 'gills-left' || layer === 'gills-right') {
      return {
        transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
        animation: `axolotl-petting-gill-flutter ${PETTING_REACTION_DURATION_MS}ms ease-out 1`,
      }
    }

    return { transform: 'translate(0, 0) rotate(0deg)' }
  }

  const handlePetting = () => {
    if (!canPet) return

    playPet()
    playAffection()

    clearTimeout(pettingTimeoutRef.current)
    clearTimeout(pettingInviteScheduleTimeoutRef.current)
    clearTimeout(pettingInviteVisibleTimeoutRef.current)
    setShowPettingInvite(false)
    setIsPetting(true)
    petPersistInFlightRef.current = true
    setOptimisticLastPettedAt(new Date().toISOString())
    pettingTimeoutRef.current = setTimeout(() => setIsPetting(false), PETTING_REACTION_DURATION_MS)

    Promise.resolve(onPetPersist?.())
      .catch(() => {
        setOptimisticLastPettedAt(null)
      })
      .finally(() => {
        petPersistInFlightRef.current = false
      })
  }

  // Feed: a brief "notice the food" anticipation beat, then the existing
  // soft curious lean toward the falling pellet (which drops in from the
  // upper-left of this box per the shared pellet-drop keyframe) — held for
  // the rest of the feed action. Play: a small, brief happy wiggle — same
  // action/reaction flow already used by BettaRig/TurtleRig
  // (isFeeding/isPlaying branch on this inner wrapper, easing back to
  // neutral otherwise). Lives here rather than the outer pet-bob element or
  // the per-layer limb/gill/tail animations so it never fights any of them,
  // and never touches the idle rig itself. Purely visual: isFeeding itself
  // is still set the instant Feed is pressed (see HabitatScreen), so this
  // never delays the actual action/persist/cooldown — it only changes how
  // the lean gets there.
  const actionStyle = isFeeding
    ? { animation: 'axolotl-feed-anticipation 700ms ease-out 1 forwards' }
    : isPlaying
      ? { animation: 'axolotl-play-wiggle 1.4s ease-in-out 1' }
      : isReleasingFeed
        ? { animation: `axolotl-feed-release ${FEED_RELEASE_DURATION_MS}ms ease-out 1 forwards` }
        : isPetting
          ? { animation: `axolotl-petting-lean ${PETTING_REACTION_DURATION_MS}ms ease-out 1 forwards` }
        : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] w-[clamp(4.75rem,26%,6.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)] ${bob}`}
      role="img"
      aria-label={`Mochi the axolotl, mood: ${mood}`}
      style={bob ? { animationDelay: `${idleLoopDelays.bob}s` } : undefined}
    >
      <style>{AXOLOTL_KEYFRAMES}</style>
      <div className="relative aspect-[503/410] w-full drop-shadow-lg" style={actionStyle}>
        {layers.map((layer, index) => {
          const anim = layer === 'tail'
            ? { className: ' animate-tail-sway motion-ambient', style: { transformOrigin: '61% 54%', animationDelay: `${idleLoopDelays.tail}s` } }
            : layer === 'gills-left'
            ? { className: ' animate-gill-drift-left motion-ambient', style: { transformOrigin: '25% 37%', animationDelay: `${idleLoopDelays.gillsLeft}s` } }
            : layer === 'gills-right'
            ? { className: ' animate-gill-drift-right motion-ambient', style: { transformOrigin: '42% 64%', animationDelay: `${idleLoopDelays.gillsRight}s` } }
            : layer === 'leg-back-left'
            ? { className: ' animate-limb-float-back-left motion-ambient', style: { transformOrigin: '51% 62%', animationDelay: `${idleLoopDelays.legBackLeft}s` } }
            : layer === 'leg-front-left'
            ? { className: ' animate-limb-float-front-left motion-ambient', style: { transformOrigin: '26% 61%', animationDelay: `${idleLoopDelays.legFrontLeft}s` } }
            : layer === 'leg-back-right'
            ? { className: ' animate-limb-float-back-right motion-ambient', style: { transformOrigin: '68% 60%', animationDelay: `${idleLoopDelays.legBackRight}s` } }
            : layer === 'leg-front-right'
            ? { className: ' animate-limb-float-front-right motion-ambient', style: { transformOrigin: '46% 62%', animationDelay: `${idleLoopDelays.legFrontRight}s` } }
            : { className: '', style: {} }

          return (
            <span
              key={layer}
              className="absolute inset-0 block"
              style={{ zIndex: index, ...getPettingWrapperStyle(layer), ...getIdleWrapperStyle(layer) }}
            >
              <img
                src={petAssetPath('axolotl', layer, colour)}
                alt=""
                className={`absolute inset-0 h-full w-full${anim.className}`}
                style={anim.style}
              />
            </span>
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
        {showPettingInvite && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center leading-none text-cream/75 animate-play-heart"
            style={{
              left: '18%',
              top: '11%',
              fontSize: '9px',
              zIndex: layers.length + 1,
            }}
          >
            ♥
          </span>
        )}
        {isPetting && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center leading-none text-cream/90 animate-play-heart"
            style={{
              left: '14%',
              top: '9%',
              fontSize: '11px',
              zIndex: layers.length + 2,
            }}
          >
            ♥
          </span>
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
        <button
          type="button"
          aria-label="Pet the axolotl"
          onClick={handlePetting}
          className="absolute left-[10%] top-[17%] h-[50%] w-[63%] rounded-full bg-transparent"
          style={{ zIndex: layers.length + 3 }}
        />
      </div>
    </div>
  )
}
