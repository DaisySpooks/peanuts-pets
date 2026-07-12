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

// Blink: swaps to `face-sleepy` since there is no separate eye layer to
// blink in isolation. This is inherently riskier than a real
// eyes-open/eyes-closed swap: `face-sleepy` is a full alternate expression,
// not a fast eye-close, and it already carries its own meaning as the
// genuine low-energy state. At the shared 120-180ms duration this read as a
// brief mood change rather than a blink, so it's shortened well below that
// (see TURTLE_BLINK_MIN/MAX_DURATION_MS below) — closer to the fastest part
// of a real blink, so the sleepy face flashes and clears before it
// registers as a distinct expression. Gated off during eating/play so it
// can never override those expressions.

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

function flipperLayerStyle(layer, jitterSeconds = 0) {
  const motion = FLIPPER_MOTION[layer]
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
// The shared `isEating` signal turns on before the (turtle-specific,
// re-paced) pellet path is actually near the mouth, so this delays
// face-eating's onset by a small local amount to match, and still holds it
// a little past the shared window so it stays visible through arrival and
// closes shortly after — all local to this rig only, same idea as betta's
// hold but with an added onset delay tuned to turtle's own pellet timing.
const EATING_ONSET_DELAY_MS = 320
const EATING_HOLD_EXTRA_MS = 250
// Shared feed timing starts `isEating` at ~1296ms into the 1800ms feed.
// Turtle's pellet path reaches its mouth endpoint at the end of that path,
// so the visible "shut" chomp should begin ~504ms after `isEating` turns on
// (1296ms + 504ms = 1800ms total), not when face-eating first appears.
const CHOMP_TRIGGER_DELAY_MS = 504
const CHOMP_DURATION_MS = 165
const IDLE_ANIMATION_MIN_INTERVAL_MS = 20000
const IDLE_ANIMATION_MAX_INTERVAL_MS = 40000
const IDLE_ANIMATION_FLIPPER_DURATION_MS = 1250
const IDLE_ANIMATION_HEAD_DURATION_MS = 1100
const PETTING_COOLDOWN_MS = 12 * 60 * 60 * 1000
const PETTING_REACTION_DURATION_MS = 700
const PETTING_INVITE_MIN_INTERVAL_MS = 15000
const PETTING_INVITE_MAX_INTERVAL_MS = 20000
const PETTING_INVITE_DURATION_MS = 1100
// Shorter/softer than useIdleBlink's shared 120-180ms default — see the
// blink comment above BASE_LAYERS for why turtle needs its own range.
const TURTLE_BLINK_MIN_DURATION_MS = 80
const TURTLE_BLINK_MAX_DURATION_MS = 110

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

// Continuous idle loops (body bob, flipper float) all start at
// animation-delay: 0 by default, so every mount begins perfectly in phase —
// on repeat viewing this reads as a mechanical, animatronic cycle rather
// than a living creature. Each loop gets its own small negative starting
// delay, generated once per mount and held for the component's lifetime, so
// loops appear to already be mid-cycle and never restart in sync with each
// other. The existing per-flipper stagger (FLIPPER_MOTION delays) is
// preserved — this jitter is added on top of it.
// Duration/amplitude/keyframes/easing are untouched.
const IDLE_LOOP_DELAY_JITTER_MAX_S = 2

function randomNegativeDelaySeconds(maxSeconds) {
  return -(Math.random() * maxSeconds)
}

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
/* Feed reaction: a brief "notice the food" perk-up (~200ms) before easing
   into the existing feed lean — same approach as PetRenderer's
   axolotl-feed-anticipation / BettaRig's betta-feed-anticipation. 100% is
   exactly the old static feed-lean transform, so the held pose itself is
   unchanged; this only prepends an anticipation beat in front of it, and
   animation-fill-mode: forwards holds that pose for the rest of the feed
   action same as the transition did before. */
@keyframes turtle-feed-anticipation {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  29% { transform: translate(-1%, -3%) rotate(-1.5deg) scale(1.025); }
  100% { transform: translate(-3%, -2%) rotate(-3deg) scale(1); }
}
/* Return-to-idle handoff: when isFeeding ends, this plays instead of
   snapping straight to the plain neutral transition. 0% is exactly the
   held feed-lean pose; 100% is neutral. Same rationale as PetRenderer's
   axolotl-feed-release / BettaRig's betta-feed-release — an animation is
   always in control of transform here, so there's never an in-between
   frame with no animation and no transition where the pose could flash to
   idle before easing starts. */
@keyframes turtle-feed-release {
  0% { transform: translate(-3%, -2%) rotate(-3deg) scale(1); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-idle-front-flipper-stretch {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  35% { transform: translate(0.3%, -1.2%) rotate(-4deg) scale(1.02); }
  70% { transform: translate(0.1%, -0.4%) rotate(-1.5deg) scale(1.008); }
}
@keyframes turtle-idle-head-tilt {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  35% { transform: translate(0.4%, -0.6%) rotate(-4.5deg); }
  72% { transform: translate(0.15%, -0.2%) rotate(-1.4deg); }
}
@keyframes turtle-petting-lean {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  35% { transform: translate(-0.8%, -1.1%) rotate(-1.5deg) scale(1.012); }
  72% { transform: translate(-0.25%, -0.35%) rotate(-0.45deg) scale(1.004); }
}
@keyframes turtle-petting-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  34% { transform: translate(-0.1%, -1.7%) rotate(-2.2deg); }
  70% { transform: translate(-0.05%, -0.45%) rotate(-0.7deg); }
}
@keyframes turtle-petting-front-flipper-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(0.2%, -0.45%) rotate(-6deg) scale(1.03); }
  56% { transform: translate(0.1%, 0.05%) rotate(3deg) scale(1.012); }
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

export default function TurtleRig({
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
}) {
  const bob = mood === 'happy' ? 'animate-pet-bob motion-ambient' : ''
  const isEatingHeld = useEatingWindow(isEating)
  const face = getTurtleFace(mood, stats, isEatingHeld, isPlaying)
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
      'flipper-back-right': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'flipper-front-left': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
      'flipper-front-right': randomNegativeDelaySeconds(IDLE_LOOP_DELAY_JITTER_MAX_S),
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
  const canIdleAnimate = !isFeeding && !isPlaying && !isCleaning && !isReleasingFeed && !isEating && !isChomping && !isSleepy && !isPetting
  const activeIdleAnimation = canIdleAnimate ? idleAnimation : null
  const effectiveLastPettedAt = optimisticLastPettedAt ?? lastPettedAt
  const lastPettedMs = effectiveLastPettedAt ? new Date(effectiveLastPettedAt).getTime() : Number.NaN
  const isPettingAvailable = !Number.isFinite(lastPettedMs) || (pettingAvailabilityNowMs - lastPettedMs) >= PETTING_COOLDOWN_MS
  const canPet = !isFeeding
    && !isPlaying
    && !isCleaning
    && !isReleasingFeed
    && !isEating
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
        const nextAnimation = Math.random() < 0.5 ? 'flipper-stretch' : 'head-tilt'
        const durationMs = nextAnimation === 'flipper-stretch'
          ? IDLE_ANIMATION_FLIPPER_DURATION_MS
          : IDLE_ANIMATION_HEAD_DURATION_MS

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

  // Gated on the whole feed sequence (isFeeding), not just the narrower
  // isEatingHeld window — isEatingHeld now turns on with a delay (see
  // useEatingWindow), which would otherwise leave a gap early in feeding
  // where blink could still fire and interfere.
  const canBlink = !isFeeding && !isPlaying && !isCleaning && !isReleasingFeed && !isSleepy && !activeIdleAnimation && !isPetting
  const isBlinking = useIdleBlink(canBlink, {
    minDurationMs: TURTLE_BLINK_MIN_DURATION_MS,
    maxDurationMs: TURTLE_BLINK_MAX_DURATION_MS,
  })
  const displayFace = isPetting ? 'face-happy' : isChomping ? 'face-sleepy' : isBlinking ? 'face-sleepy' : face
  const layers = [...BASE_LAYERS, displayFace]

  function getIdleWrapperStyle(layer) {
    if (activeIdleAnimation === 'flipper-stretch' && layer === 'flipper-front-right') {
      return {
        transformOrigin: '60% 57%',
        animation: `turtle-idle-front-flipper-stretch ${IDLE_ANIMATION_FLIPPER_DURATION_MS}ms ease-in-out 1`,
      }
    }

    if (activeIdleAnimation === 'head-tilt' && (layer === 'head' || layer === displayFace)) {
      return {
        transformOrigin: '42% 58%',
        animation: `turtle-idle-head-tilt ${IDLE_ANIMATION_HEAD_DURATION_MS}ms ease-in-out 1`,
      }
    }

    return { transform: 'translate(0, 0) rotate(0deg)' }
  }

  function getPettingWrapperStyle(layer) {
    if (!isPetting) return { transform: 'translate(0, 0) rotate(0deg)' }

    if (layer === 'head' || layer === displayFace) {
      return {
        transformOrigin: '42% 58%',
        animation: `turtle-petting-head-lift ${PETTING_REACTION_DURATION_MS}ms ease-out 1`,
      }
    }

    if (layer === 'flipper-front-right') {
      return {
        transformOrigin: '60% 57%',
        animation: `turtle-petting-front-flipper-wiggle ${PETTING_REACTION_DURATION_MS}ms ease-out 1`,
      }
    }

    return { transform: 'translate(0, 0) rotate(0deg)' }
  }

  const handlePetting = () => {
    if (!canPet) return

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
  // to neutral once isFeeding ends. Play: a soft happy paddle/bounce. All
  // live on this inner wrapper (not the outer pet-bob element) so they
  // never fight with the whole-body float. Purely visual — isFeeding is
  // still set the instant Feed is pressed, so this never delays the actual
  // action/persist/cooldown.
  const actionStyle = isFeeding
    ? { animation: 'turtle-feed-anticipation 700ms ease-out 1 forwards' }
    : isPlaying
      ? { animation: 'turtle-play-bounce 1.4s ease-in-out 1' }
      : isReleasingFeed
        ? { animation: `turtle-feed-release ${FEED_RELEASE_DURATION_MS}ms ease-out 1 forwards` }
        : isPetting
          ? { animation: `turtle-petting-lean ${PETTING_REACTION_DURATION_MS}ms ease-out 1 forwards` }
        : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] w-[clamp(4.75rem,26%,6.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)] ${bob}`}
      role="img"
      aria-label={`${name || 'Your turtle'}, mood: ${mood}`}
      style={bob ? { animationDelay: `${idleLoopDelays.bob}s` } : undefined}
    >
      <style>{TURTLE_KEYFRAMES}</style>
      <div className="relative aspect-[503/410] w-full drop-shadow-lg" style={actionStyle}>
        {layers.map((layer, index) => (
          <span
            key={layer}
            className="absolute inset-0 block"
            style={{ zIndex: index, ...getPettingWrapperStyle(layer), ...getIdleWrapperStyle(layer) }}
          >
            <img
              src={`/assets/turtle/${layer}.png`}
              alt=""
              className="absolute inset-0 h-full w-full motion-ambient"
              style={flipperLayerStyle(layer, idleLoopDelays[layer] ?? 0)}
            />
          </span>
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
              left: '16%',
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
          aria-label="Pet the turtle"
          onClick={handlePetting}
          className="absolute left-[11%] top-[19%] h-[47%] w-[60%] rounded-full bg-transparent"
          style={{ zIndex: layers.length + 3 }}
        />
      </div>
    </div>
  )
}
