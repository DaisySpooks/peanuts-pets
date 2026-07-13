import { useEffect, useRef, useState } from 'react'
import { useIdleBlink } from './useIdleBlink.js'
import { petAssetPath } from './petAssetPath.js'
import { playPet, playAffection } from '../lib/audio.js'

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
// alpha bounds (public/assets/betta/<colour>/*.png), at the edge where that part
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

function finLayerStyle(layer, jitterSeconds = 0) {
  const motion = FIN_MOTION[layer]
  if (!motion) return {}
  const totalDelaySeconds = parseFloat(motion.delay) + jitterSeconds
  return {
    transformOrigin: motion.origin,
    animation: `${motion.keyframe} ${motion.duration} ease-in-out ${totalDelaySeconds}s infinite`,
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
const IDLE_ANIMATION_MIN_INTERVAL_MS = 20000
const IDLE_ANIMATION_MAX_INTERVAL_MS = 40000
const IDLE_FIN_FLARE_DURATION_MS = 1050
const IDLE_BODY_SWAY_DURATION_MS = 1200
const PETTING_COOLDOWN_MS = 12 * 60 * 60 * 1000
// Matches PetRenderer.jsx / TurtleRig.jsx — the previous 680ms was
// unexplained drift from the shared 700ms, not a deliberate per-species
// feel difference, so normalized to keep petting timing consistent across
// species.
const PETTING_REACTION_DURATION_MS = 700
const PETTING_INVITE_MIN_INTERVAL_MS = 15000
const PETTING_INVITE_MAX_INTERVAL_MS = 20000
const PETTING_INVITE_DURATION_MS = 1100

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

// Continuous idle loops (body bob, fin/tail sway) all start at
// animation-delay: 0 by default, so every mount begins perfectly in phase —
// on repeat viewing this reads as a mechanical, animatronic cycle rather
// than a living creature. Each loop gets its own small negative starting
// delay, generated once per mount and held for the component's lifetime, so
// loops appear to already be mid-cycle and never restart in sync with each
// other. The existing per-fin stagger (FIN_MOTION delays) is preserved —
// this jitter is added on top of it. Duration/amplitude/keyframes/easing
// are untouched.
const IDLE_LOOP_DELAY_JITTER_MAX_S = 2

function randomNegativeDelaySeconds(maxSeconds) {
  return -(Math.random() * maxSeconds)
}

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
/* Feed reaction: a brief "notice the food" perk-up (~200ms) before easing
   into the existing feed lean — same approach as PetRenderer's
   axolotl-feed-anticipation. 100% is exactly the old static feed-lean
   transform, so the held pose itself is unchanged; this only prepends an
   anticipation beat in front of it, and animation-fill-mode: forwards
   holds that pose for the rest of the feed action same as the transition
   did before. */
@keyframes betta-feed-anticipation {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  29% { transform: translate(-1%, -4%) rotate(-2deg) scale(1.025); }
  100% { transform: translate(-3%, -3%) rotate(-4deg) scale(1); }
}
/* Return-to-idle handoff: when isFeeding ends, this plays instead of
   snapping straight to the plain neutral transition. 0% is exactly the
   held feed-lean pose; 100% is neutral. Same rationale as PetRenderer's
   axolotl-feed-release — an animation is always in control of transform
   here, so there's never an in-between frame with no animation and no
   transition where the pose could flash to idle before easing starts. */
@keyframes betta-feed-release {
  0% { transform: translate(-3%, -3%) rotate(-4deg) scale(1); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-idle-fin-flare {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  35% { transform: translate(0, -0.3%) rotate(-3.5deg) scale(1.03); }
  70% { transform: translate(0, 0.1%) rotate(-1.2deg) scale(1.012); }
}
@keyframes betta-idle-body-sway {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  30% { transform: translate(0.5%, -0.5%) rotate(-1.8deg); }
  72% { transform: translate(-0.3%, -0.2%) rotate(1deg); }
}
@keyframes betta-petting-sway {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  36% { transform: translate(0.2%, -0.7%) rotate(-2.4deg) scale(1.012); }
  72% { transform: translate(0.05%, -0.2%) rotate(-0.8deg) scale(1.004); }
}
@keyframes betta-petting-fin-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(0, -0.35%) rotate(-5deg) scale(1.045); }
  58% { transform: translate(0, 0.15%) rotate(2.8deg) scale(1.018); }
}
`

// How long the return-to-idle ease plays after isFeeding ends, before
// falling back to the plain static neutral style. Purely visual.
const FEED_RELEASE_DURATION_MS = 320

const PLAY_HEARTS = [
  { left: '12%', top: '10%', delayMs: 0, sizePx: 11 },
  { left: '30%', top: '4%', delayMs: 150, sizePx: 9 },
  { left: '46%', top: '14%', delayMs: 300, sizePx: 8 },
  { left: '22%', top: '22%', delayMs: 220, sizePx: 7 },
]

export default function BettaRig({
  mood = 'happy',
  stats = {},
  lastPettedAt = null,
  isEating = false,
  isFeeding = false,
  feedTrigger = 0,
  isPlaying = false,
  isCleaning = false,
  onPetPersist,
  name,
  colour = null,
}) {
  const bob = mood === 'happy' ? 'animate-pet-bob motion-ambient' : ''
  const isEatingHeld = useExtendedEating(isEating)
  const face = getBettaFaceState(mood, stats, isEatingHeld, isPlaying)
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
      'fin-top': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'fin-bottom': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'fin-side-right': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'fin-side-left': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'fin-front-right': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'fin-front-left': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
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
        const nextAnimation = Math.random() < 0.5 ? 'fin-flare' : 'body-sway'
        const durationMs = nextAnimation === 'fin-flare'
          ? IDLE_FIN_FLARE_DURATION_MS
          : IDLE_BODY_SWAY_DURATION_MS

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
    if (activeIdleAnimation === 'fin-flare' && (
      layer === 'fin-top'
      || layer === 'fin-bottom'
      || layer === 'fin-side-left'
      || layer === 'fin-side-right'
    )) {
      return {
        transformOrigin: FIN_MOTION[layer].origin,
        animation: `betta-idle-fin-flare ${IDLE_FIN_FLARE_DURATION_MS}ms ease-in-out 1`,
      }
    }

    if (activeIdleAnimation === 'body-sway' && (
      layer === 'body'
      || layer === 'head'
      || layer === 'tail'
      || layer === eyes
      || layer === mouth
    )) {
      return {
        transformOrigin: '52% 52%',
        animation: `betta-idle-body-sway ${IDLE_BODY_SWAY_DURATION_MS}ms ease-in-out 1`,
      }
    }

    return { transform: 'translate(0, 0) rotate(0deg)' }
  }

  function getPettingWrapperStyle(layer) {
    if (!isPetting) return { transform: 'translate(0, 0) rotate(0deg)' }

    if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
      return {
        transformOrigin: FIN_MOTION[layer].origin,
        animation: `betta-petting-fin-flutter ${PETTING_REACTION_DURATION_MS}ms ease-out 1`,
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

  // Feed: a brief "notice the food" anticipation beat, then lean gently
  // toward the food (held for the rest of the feed action), then ease back
  // to neutral once isFeeding ends. Play: a quick, contained happy wiggle.
  // All live on this inner wrapper (not the outer pet-bob element) so they
  // never fight with the whole-body float. Purely visual — isFeeding is
  // still set the instant Feed is pressed, so this never delays the actual
  // action/persist/cooldown.
  const actionStyle = isFeeding
    ? { animation: 'betta-feed-anticipation 700ms ease-out 1 forwards' }
    : isPlaying
      ? { animation: 'betta-play-wiggle 1.4s ease-in-out 1' }
      : isReleasingFeed
        ? { animation: `betta-feed-release ${FEED_RELEASE_DURATION_MS}ms ease-out 1 forwards` }
        : isPetting
          ? { animation: `betta-petting-sway ${PETTING_REACTION_DURATION_MS}ms ease-out 1 forwards` }
        : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] w-[clamp(4.75rem,26%,6.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)] ${bob}`}
      role="img"
      aria-label={`${name || 'Your betta'}, mood: ${mood}`}
      style={bob ? { animationDelay: `${idleLoopDelays.bob}s` } : undefined}
    >
      <style>{BETTA_KEYFRAMES}</style>
      <div className="relative aspect-[586/488] w-full drop-shadow-lg" style={actionStyle}>
        {layers.map((layer, index) => (
          <span
            key={layer}
            className="absolute inset-0 block"
            style={{ zIndex: index, ...getPettingWrapperStyle(layer), ...getIdleWrapperStyle(layer) }}
          >
            <img
              src={petAssetPath('betta', layer, colour)}
              alt=""
              className="absolute inset-0 h-full w-full motion-ambient"
              style={finLayerStyle(layer, idleLoopDelays[layer] ?? 0)}
            />
          </span>
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
        {showPettingInvite && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center leading-none text-cream/75 animate-play-heart"
            style={{
              left: '22%',
              top: '14%',
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
              left: '18%',
              top: '12%',
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
          aria-label="Pet the betta"
          onClick={handlePetting}
          className="absolute left-[12%] top-[20%] h-[44%] w-[62%] rounded-full bg-transparent"
          style={{ zIndex: layers.length + 3 }}
        />
      </div>
    </div>
  )
}
