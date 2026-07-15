import { useEffect, useRef, useState } from 'react'
import { useIdleBlink } from './useIdleBlink.js'
import { petAssetPath } from './petAssetPath.js'
import { playPet, playAffection } from '../lib/audio.js'
import {
  isLevel1PersonalityIdleAnimation,
  isLevel8PersonalityIdleAnimation,
  selectIdleAnimation,
} from './personalityIdleSelection.js'
import { PET_EXPRESSIONS } from './useTemporaryExpression.js'

// Turtle's split-face rig: a plain `head` base with separate eyes/mouth
// layers on top, same pattern as the axolotl/betta rigs.
// Only flipper-back-right/-front-left/-front-right exist (no
// flipper-back-left), so that is simply omitted rather than invented.
const BASE_LAYERS = ['flipper-back-right', 'flipper-front-left', 'shell', 'head', 'flipper-front-right']

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
// mouth-eating's onset by a small local amount to match, and still holds it
// a little past the shared window so it stays visible through arrival and
// closes shortly after — all local to this rig only, same idea as betta's
// hold but with an added onset delay tuned to turtle's own pellet timing.
const EATING_ONSET_DELAY_MS = 320
const EATING_HOLD_EXTRA_MS = 250
// Shared feed timing starts `isEating` at ~1296ms into the 1800ms feed.
// Turtle's pellet path reaches its mouth endpoint at the end of that path,
// so the visible "shut" chomp should begin ~504ms after `isEating` turns on
// (1296ms + 504ms = 1800ms total), not when mouth-eating first appears.
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
// Quicker close-eye hold than useIdleBlink's shared 120-180ms default —
// requested to make the turtle's blink read as snappier now that it has its
// own real eyes-open/eyes-closed art.
const TURTLE_BLINK_MIN_DURATION_MS = 80
const TURTLE_BLINK_MAX_DURATION_MS = 120
// Playful Level 1 "Happy Bounce" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a small body lift, a slight head pop,
// two gentle bobs, then settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const HAPPY_BOUNCE_BODY_DURATION_MS = 2100
const HAPPY_BOUNCE_HEAD_DURATION_MS = 1000
// Curious Level 1 "Curious Peek" personality-unlock celebration (see
// personalityUnlockAnimations.js) — the neck/head extending slightly
// forward, a very small head tilt, then settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const CURIOUS_PEEK_HEAD_DURATION_MS = 1600
// Gentle Level 1 "Happy Wave" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a gentle head dip/nod plus a slight
// front-flipper movement (flipper-front-right, the same layer/origin
// already used for its idle flipper-stretch), then settle. One-shot, plays
// only inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const GENTLE_WAVE_HEAD_DURATION_MS = 1500
const GENTLE_WAVE_FLIPPER_DURATION_MS = 1300
// Sleepy Level 1 "Sleepy Stretch" personality-unlock celebration (see
// personalityUnlockAnimations.js) — the head/neck slowly extending, both
// front flippers stretching outward (flipper-front-left/flipper-front-
// right, the same layers/origins already used for their idle flipper-
// stretch), then settle into a relaxed pose. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SLEEPY_STRETCH_HEAD_DURATION_MS = 2400
const SLEEPY_STRETCH_FLIPPER_DURATION_MS = 2000
// Foodie Level 1 "Hungry Wiggle" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a small eager body wiggle, a slight
// head lift toward the feeding area, and a tiny front-flipper movement
// (flipper-front-right, the same layer/origin already used for its idle
// flipper-stretch), then settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const HUNGRY_WIGGLE_BODY_DURATION_MS = 1900
const HUNGRY_WIGGLE_HEAD_DURATION_MS = 1100
const HUNGRY_WIGGLE_FLIPPER_DURATION_MS = 900
// Playful Level 3 "Playtime Welcome" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a small eager head lift, a gentle
// double bob, and a slight front-flipper movement (flipper-front-right, the
// same layer/origin already used for its idle flipper-stretch), then settle
// facing forward. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const PLAYTIME_WELCOME_HEAD_DURATION_MS = 1500
const PLAYTIME_WELCOME_FLIPPER_DURATION_MS = 900
// Playful Level 5 "Encore!" personality-unlock celebration (see
// personalityUnlockAnimations.js) — an eager double bob with a brief pause
// between beats, a small head lift, and a quick front-flipper movement,
// then settle happy. Distinct from Level 1 Happy Bounce's single bounce and
// Level 3 Playtime Welcome's greeting cadence. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const ENCORE_BODY_DURATION_MS = 2200
const ENCORE_HEAD_DURATION_MS = 1100
const ENCORE_FLIPPER_DURATION_MS = 850
const ENCORE_FLIPPER_DELAY_MS = 350
// Playful Level 8 "Show Off" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a proud head lift with a small body
// bob, a brief double front-flipper flourish, then a short poised pause
// before settling. Distinct from Encore's bounce rhythm by reading as a
// self-conscious little performance. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SHOW_OFF_BODY_DURATION_MS = 2400
const SHOW_OFF_HEAD_DURATION_MS = 1200
const SHOW_OFF_FLIPPER_DURATION_MS = 1000
const SHOW_OFF_FLIPPER_DELAY_MS = 250
// Playful Level 12 "You're Here!" personality-unlock celebration — a quick
// head-lift notice, eager approach, tiny flipper wave, forward-facing pause,
// then a calm settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const YOURE_HERE_BODY_DURATION_MS = 2800
const YOURE_HERE_HEAD_DURATION_MS = 1250
const YOURE_HERE_FLIPPER_DURATION_MS = 800
const YOURE_HERE_FLIPPER_DELAY_MS = 1050
// Curious Level 12 "Follow Me" personality-unlock celebration — notices the
// player, moves toward a side interest, extends there, then tilts back toward
// the player to wait before settling. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const FOLLOW_ME_BODY_DURATION_MS = 3000
const FOLLOW_ME_HEAD_DURATION_MS = 2300
// Gentle Level 12 "Happy Together" personality-unlock celebration — a calm
// forward approach, soft closed-eye moment, breathing-like rise and fall,
// quiet forward linger, and settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const HAPPY_TOGETHER_BODY_DURATION_MS = 2800
const HAPPY_TOGETHER_HEAD_DURATION_MS = 1800
const HAPPY_TOGETHER_EYES_DURATION_MS = 2100
// Sleepy Level 12 "Sleep Beside You" personality-unlock celebration — first
// approaches the player, lowers and tucks the head into rest, closes the eyes,
// then wakes gently and settles. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SLEEP_BESIDE_YOU_BODY_DURATION_MS = 3300
const SLEEP_BESIDE_YOU_HEAD_DURATION_MS = 3000
const SLEEP_BESIDE_YOU_EYES_DURATION_MS = 3000
// Foodie Level 12 "Sharing Time" personality-unlock celebration — lifts toward
// the player, tilts toward the feeding side, returns forward for a hopeful
// pause, then settles. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SHARING_TIME_BODY_DURATION_MS = 2800
const SHARING_TIME_HEAD_DURATION_MS = 1700
const SHARING_TIME_FLIPPER_DURATION_MS = 800
const SHARING_TIME_FLIPPER_DELAY_MS = 900
// Curious Level 8 "Explorer" personality-unlock celebration (see
// personalityUnlockAnimations.js) — shifts slightly toward one side,
// extends the head/neck as if inspecting something there, adds one brief
// curious tilt, holds a short investigative pause, then settles. Distinct
// from Who's There?'s forward greeting reach and What Was That's shorter
// reactive investigate beat by reading as a deliberate sideward
// inspection. One-shot, plays only inside PersonalityUnlockCelebration.jsx
// via the celebrationAnimation prop.
const EXPLORER_BODY_DURATION_MS = 2500
const EXPLORER_HEAD_DURATION_MS = 2500
// Curious Level 3 "Who's There?" personality-unlock greeting (see
// personalityUnlockAnimations.js) — extends the head/neck slightly toward
// the glass, holds in a plateau with a small curious tilt (a longer pause
// than Level 1 Curious Peek's brief extend), then settles facing forward.
// No flipper movement (the spec only calls for head/neck + pause). One-
// shot, plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const WHOS_THERE_HEAD_DURATION_MS = 2400
// Curious Level 5 "What Was That?" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a brief still pause, then
// extends the head slightly into one small left-right curious tilt, then
// settles facing forward. Distinct from Level 1 Curious Peek's quicker
// immediate extend and Level 3 Who's There?'s longer held curious reach.
// One-shot, plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const WHAT_WAS_THAT_HEAD_DURATION_MS = 2200
// Gentle Level 3 "Warm Hello" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a slow head lift held as a clear
// acknowledgement beat, then one calm nod, then a slight front-flipper wave
// (flipper-front-right) starting only after the head's acknowledgement has
// read (via animation-delay), then settle facing forward. Distinct from
// Level 1 Happy Wave, which starts its flipper movement immediately
// alongside the head dip with no separate acknowledgement beat. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const WARM_HELLO_HEAD_DURATION_MS = 2200
const WARM_HELLO_FLIPPER_DURATION_MS = 1200
const WARM_HELLO_FLIPPER_DELAY_MS = 900
// Gentle Level 5 "Thank You" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a small forward
// acknowledgement, then one slow head nod and a brief front-flipper wave,
// then settles facing forward. Distinct from Level 1 Happy Wave's simpler
// wave and Level 3 Warm Hello's held hello beat by using an acknowledge,
// nod or wave, relax rhythm. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const THANK_YOU_HEAD_DURATION_MS = 2200
const THANK_YOU_FLIPPER_DURATION_MS = 1200
const THANK_YOU_FLIPPER_DELAY_MS = 800
// Gentle Level 8 "Peaceful Moment" personality-unlock celebration (see
// personalityUnlockAnimations.js) — the head lowers slightly, the turtle
// briefly closes its eyes using the existing closed-eye art, and the body
// rises/falls once like a calm breath before settling. Distinct from Cozy
// Time's sleepier settle by staying upright and content rather than
// drowsy. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const PEACEFUL_MOMENT_BODY_DURATION_MS = 2600
const PEACEFUL_MOMENT_HEAD_DURATION_MS = 2200
const PEACEFUL_MOMENT_EYES_DURATION_MS = 2200
// Sleepy Level 3 "Drowsy Greeting" personality-unlock greeting (see
// personalityUnlockAnimations.js) — begins in a slightly tucked/lowered
// head pose (the 0% keyframe itself is the lowered pose, not neutral),
// holds there briefly as if still asleep, slowly lifts the head, then a
// small front-flipper stretch as it wakes, then settle facing forward.
// Distinct from Level 1 Sleepy Stretch, which starts from the normal
// neutral pose and extends outward rather than waking up from a lowered
// rest pose. One-shot, plays only inside PersonalityUnlockCelebration.jsx
// via the celebrationAnimation prop.
const DROWSY_GREETING_HEAD_DURATION_MS = 2800
const DROWSY_GREETING_FLIPPER_DURATION_MS = 1400
const DROWSY_GREETING_FLIPPER_DELAY_MS = 1400
// Sleepy Level 5 "Cozy Time" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a small relaxed stretch that eases into
// a comfortable lowered-head pose, with the front flippers relaxing
// slightly. Distinct from Level 1 Sleepy Stretch's clearer stretch and
// Level 3 Drowsy Greeting's waking acknowledgement. One-shot, plays only
// inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const COZY_TIME_HEAD_DURATION_MS = 2600
const COZY_TIME_FLIPPER_DURATION_MS = 1600
// Sleepy Level 8 "Power Nap" personality-unlock celebration (see
// personalityUnlockAnimations.js) — slowly tucks the head down into a
// brief closed-eye rest, holds that resting pose for a short beat, then
// gently lifts back up and reopens the eyes. Distinct from Drowsy Greeting's
// waking acknowledgement and Cozy Time's content settle by clearly reading
// as a tiny nap. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const POWER_NAP_HEAD_DURATION_MS = 2900
const POWER_NAP_EYES_DURATION_MS = 2900
// Foodie Level 3 "Snack Check" personality-unlock greeting (see
// personalityUnlockAnimations.js) — first acknowledges the player with a
// small head lift, then turns toward the feeding area for a clear
// "checking for snacks" beat, with a tiny eager front-flipper movement
// beginning only during that second beat, then settle facing forward.
// Distinct from Level 1 Hungry Wiggle, which is a quicker immediate eager
// response rather than a readable two-step greeting. One-shot, plays only
// inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const SNACK_CHECK_HEAD_DURATION_MS = 2400
const SNACK_CHECK_FLIPPER_DURATION_MS = 850
const SNACK_CHECK_FLIPPER_DELAY_MS = 1100
// Foodie Level 5 "Still Hungry" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a small satisfied settle,
// pauses briefly, then lifts hopefully toward the feeding area with a tiny
// front-flipper movement, then settles facing forward. Distinct from Level
// 1 Hungry Wiggle's immediate food excitement and Level 3 Snack Check's
// player-first greeting by reading as calm hopeful interest after eating.
// One-shot, plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const STILL_HUNGRY_HEAD_DURATION_MS = 2700
const STILL_HUNGRY_FLIPPER_DURATION_MS = 850
const STILL_HUNGRY_FLIPPER_DELAY_MS = 1450
// Foodie Level 8 "Food Patrol" personality-unlock celebration (see
// personalityUnlockAnimations.js) — shifts toward the feeding side, looks
// slightly upward as if checking the drop zone, holds a hopeful pause, adds
// one tiny front-flipper movement, then settles calmly when nothing
// appears. Distinct from Snack Check's player-first greeting and Still
// Hungry's post-meal hope by reading as a calm habitat scan. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const FOOD_PATROL_HEAD_DURATION_MS = 2500
const FOOD_PATROL_FLIPPER_DURATION_MS = 800
const FOOD_PATROL_FLIPPER_DELAY_MS = 1200

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

function getTurtleFaceState(mood, stats, expression, isEating) {
  if (isEating) return { eyes: 'eyes-open', mouth: 'mouth-eating', canBlink: false }
  if (expression === PET_EXPRESSIONS.happy) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

  const happiness = typeof stats.happiness === 'number' ? stats.happiness : null
  const isSleepy = mood === 'sleepy' || mood === 'tired' || mood === 'resting'
    || (happiness !== null && happiness <= SLEEPY_HAPPINESS_THRESHOLD)
  if (isSleepy) return { eyes: 'eyes-closed', mouth: 'mouth-sleepy', canBlink: false }

  const isHappy = mood === 'happy' && happiness !== null && happiness >= HAPPY_HAPPINESS_THRESHOLD
  if (isHappy) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

  return { eyes: 'eyes-open', mouth: 'mouth-idle', canBlink: true }
}

// Turtle-specific food path and play bounce, scoped entirely to this file
// via an inline <style> tag rather than the shared `pellet-drop` keyframe
// in tailwind.config.js (tuned for the axolotl's mouth; must stay untouched
// for axolotl/betta). Turtle's mouth is estimated at ~16%,46% of its own
// canvas — an anatomical estimate (front/lower part of the face) rather
// than a pixel-measured target, and may need a small follow-up correction
// once seen rendered.
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
@keyframes turtle-happy-bounce-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  20% { transform: translate(0, -3%) rotate(-1.5deg) scale(1.015); }
  45% { transform: translate(0, -1%) rotate(1deg) scale(1.006); }
  70% { transform: translate(0, -1.8%) rotate(-1deg) scale(1.01); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-happy-bounce-head-pop {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  30% { transform: translate(0.3%, -2.2%) rotate(-4deg); }
  60% { transform: translate(0.1%, -0.6%) rotate(-1deg); }
}
@keyframes turtle-curious-peek-head-extend {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  40% { transform: translate(1.6%, -0.3%) rotate(-3deg); }
  75% { transform: translate(0.6%, -0.1%) rotate(-1deg); }
}
@keyframes turtle-gentle-wave-head-nod {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  30% { transform: translate(0, 1%) rotate(4deg); }
  65% { transform: translate(0, 0.3%) rotate(1deg); }
}
@keyframes turtle-gentle-wave-flipper {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(-8deg); }
  70% { transform: rotate(4deg); }
}
@keyframes turtle-sleepy-stretch-head-extend {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  45% { transform: translate(1.8%, 0.2%) rotate(-1deg); }
  80% { transform: translate(0.6%, 0.05%) rotate(-0.3deg); }
}
@keyframes turtle-sleepy-stretch-flipper {
  0%, 100% { transform: rotate(0deg) scale(1); }
  45% { transform: rotate(10deg) scale(1.04); }
  80% { transform: rotate(3deg) scale(1.012); }
}
@keyframes turtle-hungry-wiggle-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(-1%, -0.5%) rotate(-2deg) scale(1.01); }
  50% { transform: translate(0.8%, -1%) rotate(2deg) scale(1.008); }
  75% { transform: translate(-0.4%, -0.3%) rotate(-1deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-hungry-wiggle-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  35% { transform: translate(0.5%, -2%) rotate(-3deg); }
  70% { transform: translate(0.2%, -0.6%) rotate(-1deg); }
}
@keyframes turtle-hungry-wiggle-flipper {
  0%, 100% { transform: rotate(0deg); }
  40% { transform: rotate(-7deg); }
  75% { transform: rotate(4deg); }
}
@keyframes turtle-playtime-welcome-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(0.3%, -1.8%) rotate(-3deg); }
  50% { transform: translate(0.1%, -0.6%) rotate(-1deg); }
  70% { transform: translate(0.2%, -1.2%) rotate(-2deg); }
  90% { transform: translate(0.05%, -0.3%) rotate(-0.5deg); }
}
@keyframes turtle-playtime-welcome-flipper {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(-6deg); }
  70% { transform: rotate(3deg); }
}
@keyframes turtle-encore-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  18% { transform: translate(0, -2.8%) rotate(-1.4deg) scale(1.014); }
  32% { transform: translate(0, -2.8%) rotate(-1.4deg) scale(1.014); }
  50% { transform: translate(0, -0.2%) rotate(-0.2deg) scale(1.002); }
  66% { transform: translate(0, -1.4%) rotate(-0.8deg) scale(1.008); }
  80% { transform: translate(0, -1.4%) rotate(-0.8deg) scale(1.008); }
  92% { transform: translate(0, -0.08%) rotate(-0.1deg) scale(1.001); }
}
@keyframes turtle-encore-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  35% { transform: translate(0.28%, -1.8%) rotate(-3deg); }
  72% { transform: translate(0.1%, -0.4%) rotate(-0.8deg); }
}
@keyframes turtle-encore-flipper {
  0%, 100% { transform: rotate(0deg); }
  36% { transform: rotate(-7deg); }
  72% { transform: rotate(4deg); }
}
@keyframes turtle-show-off-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(0, -1.8%) rotate(-1deg) scale(1.012); }
  40% { transform: translate(0, -1.8%) rotate(-1deg) scale(1.012); }
  66% { transform: translate(0, -0.55%) rotate(-0.3deg) scale(1.004); }
  80% { transform: translate(0, -0.55%) rotate(-0.3deg) scale(1.004); }
  92% { transform: translate(0, -0.06%) rotate(-0.08deg) scale(1.001); }
}
@keyframes turtle-show-off-head-lift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  32% { transform: translate(0.3%, -2%) rotate(-3.4deg); }
  52% { transform: translate(0.3%, -2%) rotate(-3.4deg); }
  76% { transform: translate(0.08%, -0.45%) rotate(-0.8deg); }
}
@keyframes turtle-show-off-flipper {
  0%, 100% { transform: rotate(0deg); }
  22% { transform: rotate(-8deg); }
  40% { transform: rotate(5deg); }
  58% { transform: rotate(-7deg); }
  76% { transform: rotate(3deg); }
}
@keyframes turtle-youre-here-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  18% { transform: translate(0, -1.8%) rotate(-1deg) scale(1.01); }
  44% { transform: translate(-1.5%, -0.15%) rotate(-0.7deg) scale(1.015); }
  70% { transform: translate(-1.5%, -0.15%) rotate(-0.7deg) scale(1.015); }
  88% { transform: translate(-0.2%, -0.03%) rotate(-0.08deg) scale(1.001); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-youre-here-head-lift {
  0% { transform: translate(0, 0) rotate(0deg); }
  18% { transform: translate(0.25%, -2.1%) rotate(-3.5deg); }
  44%, 72% { transform: translate(0.55%, -0.5%) rotate(-1deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-youre-here-flipper {
  0%, 100% { transform: rotate(0deg); }
  40% { transform: rotate(-6deg); }
  72% { transform: rotate(3deg); }
}
@keyframes turtle-follow-me-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  16% { transform: translate(0, -0.7%) rotate(-1deg) scale(1.006); }
  40% { transform: translate(1.45%, -0.08%) rotate(1deg) scale(1.01); }
  60% { transform: translate(1.45%, -0.08%) rotate(1deg) scale(1.01); }
  74% { transform: translate(-0.35%, -0.04%) rotate(-1.3deg) scale(1.004); }
  88% { transform: translate(-0.35%, -0.04%) rotate(-1.3deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-follow-me-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  18% { transform: translate(0.2%, -1.1%) rotate(-2.8deg); }
  42% { transform: translate(1.7%, -0.18%) rotate(-3.8deg); }
  60% { transform: translate(1.7%, -0.18%) rotate(-3.8deg); }
  76% { transform: translate(-0.5%, -0.08%) rotate(2.6deg); }
  88% { transform: translate(-0.5%, -0.08%) rotate(2.6deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-happy-together-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(0, -0.8%) rotate(-0.3deg) scale(1.008); }
  44% { transform: translate(0, -0.8%) rotate(-0.3deg) scale(1.008); }
  58% { transform: translate(0, -0.15%) rotate(0.15deg) scale(1.002); }
  72% { transform: translate(0, -0.8%) rotate(-0.3deg) scale(1.008); }
  88% { transform: translate(0, -0.12%) rotate(-0.04deg) scale(1.001); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-happy-together-head {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  28% { transform: translate(0.15%, -1.25%) rotate(-2deg); }
  52% { transform: translate(0.15%, -1.25%) rotate(-2deg); }
  78% { transform: translate(0.03%, -0.18%) rotate(-0.3deg); }
}
@keyframes turtle-happy-together-eyes {
  0%, 24%, 78%, 100% { opacity: 0; }
  36%, 66% { opacity: 1; }
}
@keyframes turtle-sleep-beside-you-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  22% { transform: translate(0, -0.45%) rotate(-0.7deg) scale(1.006); }
  42% { transform: translate(0, -0.8%) rotate(-0.5deg) scale(1.008); }
  58% { transform: translate(0, 0.75%) rotate(1.1deg) scale(0.998); }
  76% { transform: translate(0, 0.75%) rotate(1.1deg) scale(0.998); }
  90% { transform: translate(0, -0.12%) rotate(-0.15deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-sleep-beside-you-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  22% { transform: translate(0.15%, -1.3%) rotate(-2deg); }
  42% { transform: translate(0.15%, -0.35%) rotate(0.4deg); }
  58% { transform: translate(0.12%, 1.15%) rotate(2.8deg); }
  76% { transform: translate(0.12%, 1.15%) rotate(2.8deg); }
  91% { transform: translate(0.03%, -0.18%) rotate(-0.3deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-sleep-beside-you-eyes {
  0%, 28%, 80%, 100% { opacity: 0; }
  40%, 70% { opacity: 1; }
}
@keyframes turtle-sharing-time-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  18% { transform: translate(0, -0.45%) rotate(-0.8deg) scale(1.006); }
  40% { transform: translate(0.85%, -0.08%) rotate(1.4deg) scale(1.01); }
  58% { transform: translate(0.85%, -0.08%) rotate(1.4deg) scale(1.01); }
  72% { transform: translate(-0.2%, -0.04%) rotate(-0.9deg) scale(1.003); }
  86% { transform: translate(-0.2%, -0.04%) rotate(-0.9deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes turtle-sharing-time-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(0.15%, -1.35%) rotate(-2.2deg); }
  40% { transform: translate(1.55%, -0.1%) rotate(2.8deg); }
  58% { transform: translate(1.55%, -0.1%) rotate(2.8deg); }
  74% { transform: translate(-0.15%, -0.1%) rotate(-1.2deg); }
  88% { transform: translate(-0.15%, -0.1%) rotate(-1.2deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-sharing-time-flipper {
  0%, 100% { transform: rotate(0deg); }
  48% { transform: rotate(-4deg); }
  70% { transform: rotate(2deg); }
}
@keyframes turtle-explorer-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(-1.4%, -0.18%) rotate(-1.2deg) scale(1.008); }
  52% { transform: translate(-1.4%, -0.18%) rotate(-1.2deg) scale(1.008); }
  76% { transform: translate(-0.45%, -0.05%) rotate(-0.45deg) scale(1.002); }
  90% { transform: translate(-0.45%, -0.05%) rotate(-0.45deg) scale(1.002); }
}
@keyframes turtle-explorer-head {
  0%, 14% { transform: translate(0, 0) rotate(0deg); }
  38% { transform: translate(1.8%, -0.28%) rotate(-2.6deg); }
  56% { transform: translate(1.8%, -0.28%) rotate(2deg); }
  74% { transform: translate(1.8%, -0.28%) rotate(-1.3deg); }
  88% { transform: translate(0.35%, -0.05%) rotate(-0.4deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-curious-greeting-head-extend {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  30% { transform: translate(1.7%, -0.3%) rotate(-3deg); }
  60% { transform: translate(1.7%, -0.3%) rotate(-3deg); }
  85% { transform: translate(0.6%, -0.1%) rotate(-1deg); }
}
@keyframes turtle-what-was-that-head {
  0%, 16% { transform: translate(0, 0) rotate(0deg); }
  44% { transform: translate(1.3%, -0.15%) rotate(-3deg); }
  62% { transform: translate(1.3%, -0.15%) rotate(2.2deg); }
  82% { transform: translate(0.35%, -0.04%) rotate(-0.5deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-warm-hello-head {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(0, -1.2%) rotate(-2deg); }
  40% { transform: translate(0, -1.2%) rotate(-2deg); }
  65% { transform: translate(0, 0.8%) rotate(3deg); }
  85% { transform: translate(0, 0.2%) rotate(0.8deg); }
}
@keyframes turtle-warm-hello-flipper {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  50% { transform: rotate(5deg); }
  75% { transform: rotate(-3deg); }
}
@keyframes turtle-thank-you-head {
  0%, 18% { transform: translate(0, 0) rotate(0deg); }
  38% { transform: translate(0.2%, -0.7%) rotate(-1.8deg); }
  60% { transform: translate(0, 0.95%) rotate(3.6deg); }
  82% { transform: translate(0, 0.2%) rotate(0.8deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-thank-you-flipper {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-7deg); }
  50% { transform: rotate(4deg); }
  75% { transform: rotate(-2deg); }
}
@keyframes turtle-peaceful-moment-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  34% { transform: translate(0, -0.65%) rotate(-0.2deg) scale(1.01); }
  56% { transform: translate(0, -0.65%) rotate(-0.2deg) scale(1.01); }
  82% { transform: translate(0, -0.12%) rotate(-0.04deg) scale(1.002); }
}
@keyframes turtle-peaceful-moment-head {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  30% { transform: translate(0.1%, 0.55%) rotate(1.8deg); }
  58% { transform: translate(0.1%, 0.55%) rotate(1.8deg); }
  82% { transform: translate(0.02%, 0.12%) rotate(0.4deg); }
}
@keyframes turtle-peaceful-moment-eyes {
  0%, 24%, 78%, 100% { opacity: 0; }
  36%, 64% { opacity: 1; }
}
@keyframes turtle-drowsy-greeting-head {
  0% { transform: translate(0, 1%) rotate(3deg); }
  18% { transform: translate(0, 1%) rotate(3deg); }
  55% { transform: translate(0.4%, -1%) rotate(-2deg); }
  80% { transform: translate(0.15%, -0.3%) rotate(-0.6deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-drowsy-greeting-flipper-stretch {
  0%, 100% { transform: rotate(0deg) scale(1); }
  55% { transform: rotate(8deg) scale(1.03); }
  85% { transform: rotate(2deg) scale(1.01); }
}
@keyframes turtle-cozy-time-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  32% { transform: translate(0.25%, -0.2%) rotate(-0.8deg); }
  68% { transform: translate(0, 0.95%) rotate(2.8deg); }
  100% { transform: translate(0, 0.9%) rotate(2.4deg); }
}
@keyframes turtle-cozy-time-flipper-relax {
  0%, 100% { transform: rotate(0deg) scale(1); }
  45% { transform: rotate(5deg) scale(1.02); }
  80% { transform: rotate(2deg) scale(1.008); }
}
@keyframes turtle-power-nap-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  26% { transform: translate(0.05%, 1.05%) rotate(3.1deg); }
  58% { transform: translate(0.05%, 1.05%) rotate(3.1deg); }
  82% { transform: translate(0.18%, 0.2%) rotate(0.7deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-power-nap-eyes {
  0%, 16%, 82%, 100% { opacity: 0; }
  28%, 68% { opacity: 1; }
}
@keyframes turtle-snack-check-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  18% { transform: translate(0.15%, -1.2%) rotate(-1.8deg); }
  34% { transform: translate(0.15%, -1.2%) rotate(-1.8deg); }
  60% { transform: translate(1.2%, -0.25%) rotate(-4deg); }
  78% { transform: translate(1.2%, -0.25%) rotate(-4deg); }
  92% { transform: translate(0.25%, -0.06%) rotate(-0.9deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-snack-check-flipper {
  0%, 100% { transform: rotate(0deg) scale(1); }
  38% { transform: rotate(-7deg) scale(1.025); }
  72% { transform: rotate(3deg) scale(1.008); }
}
@keyframes turtle-still-hungry-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  18% { transform: translate(0, 0.45%) rotate(1.1deg); }
  34% { transform: translate(0, 0.45%) rotate(1.1deg); }
  50% { transform: translate(0, 0.45%) rotate(1.1deg); }
  72% { transform: translate(1.1%, -0.35%) rotate(-3.5deg); }
  84% { transform: translate(1.1%, -0.35%) rotate(-3.5deg); }
  94% { transform: translate(0.22%, -0.08%) rotate(-0.8deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-still-hungry-flipper {
  0%, 100% { transform: rotate(0deg) scale(1); }
  40% { transform: rotate(-6deg) scale(1.02); }
  72% { transform: rotate(2.5deg) scale(1.006); }
}
@keyframes turtle-food-patrol-head {
  0% { transform: translate(0, 0) rotate(0deg); }
  26% { transform: translate(1.15%, -0.55%) rotate(-2.8deg); }
  46% { transform: translate(1.15%, -0.55%) rotate(-2.8deg); }
  64% { transform: translate(1.28%, -1.05%) rotate(-4.1deg); }
  78% { transform: translate(1.28%, -1.05%) rotate(-4.1deg); }
  92% { transform: translate(0.25%, -0.12%) rotate(-0.9deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes turtle-food-patrol-flipper {
  0%, 100% { transform: rotate(0deg) scale(1); }
  36% { transform: rotate(-5deg) scale(1.016); }
  72% { transform: rotate(2deg) scale(1.005); }
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
  expression = PET_EXPRESSIONS.neutral,
  isEating = false,
  isFeeding = false,
  feedTrigger = 0,
  isPlaying = false,
  isCleaning = false,
  onPetPersist,
  name,
  colour = null,
  presentationMode = 'habitat',
  celebrationGreeting = false,
  earnedPersonalityUnlockKeys = [],
  greetingActive = false,
  greetingAnimation = null,
  actionReactionAnimation = null,
  attachmentAnimation = null,
  onAttachmentAnimationComplete,
  personalityUnlockCelebrationActive = false,
  celebrationAnimation = null,
}) {
  const isCelebrationMode = presentationMode === 'celebration'
  const bob = mood === 'happy' ? 'animate-pet-bob motion-ambient' : ''
  const sizeClass = isCelebrationMode
    ? 'w-[clamp(12rem,62vw,25rem)] sm:w-[clamp(15rem,55vw,31rem)] md:w-[clamp(18rem,44vw,37rem)]'
    : 'w-[clamp(4.75rem,26%,6.5rem)] sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)]'
  const isEatingHeld = useEatingWindow(isEating)
  const face = getTurtleFaceState(mood, stats, expression, isEatingHeld)
  const [isChomping, setIsChomping] = useState(false)
  const chompStartTimeoutRef = useRef(null)
  const chompEndTimeoutRef = useRef(null)
  const [isReleasingFeed, setIsReleasingFeed] = useState(false)
  const wasFeedingRef = useRef(isFeeding)
  const suppressFoodPatrolRef = useRef(false)
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
      suppressFoodPatrolRef.current = true
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
  const canIdleAnimate = !isCelebrationMode
    && !isFeeding
    && !isPlaying
    && !isCleaning
    && !isReleasingFeed
    && !isEating
    && !isChomping
    && !isSleepy
    && !isPetting
    && !actionReactionAnimation
    && !attachmentAnimation
    && !greetingActive
    && !personalityUnlockCelebrationActive
    && !celebrationAnimation
  const activeIdleAnimation = canIdleAnimate ? idleAnimation : null
  const personalityIdleAnimation = isLevel1PersonalityIdleAnimation(activeIdleAnimation) ? activeIdleAnimation : null
  const level8HabitAnimation = isLevel8PersonalityIdleAnimation(activeIdleAnimation) ? activeIdleAnimation : null
  const level1Animation = celebrationAnimation ?? personalityIdleAnimation
  const activeGreetingAnimation = greetingActive ? greetingAnimation : null
  const specialAnimation = attachmentAnimation ?? actionReactionAnimation ?? activeGreetingAnimation ?? celebrationAnimation ?? level8HabitAnimation
  const effectiveLastPettedAt = optimisticLastPettedAt ?? lastPettedAt
  const lastPettedMs = effectiveLastPettedAt ? new Date(effectiveLastPettedAt).getTime() : Number.NaN
  const isPettingAvailable = !Number.isFinite(lastPettedMs) || (pettingAvailabilityNowMs - lastPettedMs) >= PETTING_COOLDOWN_MS
  const canPet = !isCelebrationMode
    && !isFeeding
    && !isPlaying
    && !isCleaning
    && !isReleasingFeed
    && !isEating
    && !isChomping
    && !isSleepy
    && !activeIdleAnimation
    && !isPetting
    && !actionReactionAnimation
    && !attachmentAnimation
    && !personalityUnlockCelebrationActive
    && !celebrationAnimation
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
        const fallbackAnimation = Math.random() < 0.5 ? 'flipper-stretch' : 'head-tilt'
        const nextAnimation = selectIdleAnimation({
          species: 'turtle',
          earnedPersonalityUnlockKeys,
          fallbackAnimation,
          suppressFoodPatrol: suppressFoodPatrolRef.current,
        })
        suppressFoodPatrolRef.current = false
        const durationMs = nextAnimation === 'flipper-stretch'
          ? IDLE_ANIMATION_FLIPPER_DURATION_MS
          : nextAnimation === 'happy-bounce'
          ? HAPPY_BOUNCE_BODY_DURATION_MS
          : nextAnimation === 'curious-peek'
          ? CURIOUS_PEEK_HEAD_DURATION_MS
          : nextAnimation === 'gentle-wave'
          ? GENTLE_WAVE_HEAD_DURATION_MS
          : nextAnimation === 'sleepy-stretch'
          ? SLEEPY_STRETCH_HEAD_DURATION_MS
          : nextAnimation === 'hungry-wiggle'
          ? HUNGRY_WIGGLE_BODY_DURATION_MS
          : nextAnimation === 'show-off'
          ? SHOW_OFF_BODY_DURATION_MS
          : nextAnimation === 'explorer'
          ? EXPLORER_HEAD_DURATION_MS
          : nextAnimation === 'peaceful-moment'
          ? PEACEFUL_MOMENT_BODY_DURATION_MS
          : nextAnimation === 'power-nap'
          ? POWER_NAP_HEAD_DURATION_MS
          : nextAnimation === 'food-patrol'
          ? FOOD_PATROL_HEAD_DURATION_MS
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
  }, [canIdleAnimate, earnedPersonalityUnlockKeys])

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
  const canBlink = !isCelebrationMode
    && !isFeeding
    && !isPlaying
    && !isCleaning
    && !isReleasingFeed
    && !isSleepy
    && !activeIdleAnimation
    && !isPetting
    && !actionReactionAnimation
    && !attachmentAnimation
  const isBlinking = useIdleBlink(canBlink, {
    minDurationMs: TURTLE_BLINK_MIN_DURATION_MS,
    maxDurationMs: TURTLE_BLINK_MAX_DURATION_MS,
  })
  const eyes = isChomping ? 'eyes-closed' : isBlinking ? 'eyes-closed' : face.eyes
  const mouth = isChomping ? 'mouth-idle' : face.mouth
  const pettingEyes = isPetting ? 'eyes-closed' : eyes
  const pettingMouth = isPetting ? 'mouth-happy' : mouth
  const usesClosedEyesOverlay = (specialAnimation === 'peaceful-moment' || specialAnimation === 'power-nap' || specialAnimation === 'happy-together' || specialAnimation === 'sleep-beside-you') && !isPetting
  const layers = usesClosedEyesOverlay
    ? [...BASE_LAYERS, eyes, 'eyes-closed', pettingMouth]
    : [...BASE_LAYERS, pettingEyes, pettingMouth]

  function getIdleWrapperStyle(layer) {
    if (activeIdleAnimation === 'flipper-stretch' && layer === 'flipper-front-right') {
      return {
        transformOrigin: '60% 57%',
        animation: `turtle-idle-front-flipper-stretch ${IDLE_ANIMATION_FLIPPER_DURATION_MS}ms ease-in-out 1`,
      }
    }

    if (activeIdleAnimation === 'head-tilt' && (layer === 'head' || layer === eyes || layer === mouth)) {
      return {
        transformOrigin: '42% 58%',
        animation: `turtle-idle-head-tilt ${IDLE_ANIMATION_HEAD_DURATION_MS}ms ease-in-out 1`,
      }
    }

    return { transform: 'translate(0, 0) rotate(0deg)' }
  }

  function getCelebrationWrapperStyle(layer) {
    if (level1Animation === 'happy-bounce') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-happy-bounce-head-pop ${HAPPY_BOUNCE_HEAD_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'curious-peek') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-curious-peek-head-extend ${CURIOUS_PEEK_HEAD_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'gentle-wave') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-gentle-wave-head-nod ${GENTLE_WAVE_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-gentle-wave-flipper ${GENTLE_WAVE_FLIPPER_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'sleepy-stretch') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-sleepy-stretch-head-extend ${SLEEPY_STRETCH_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-left' || layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION[layer].origin,
          animation: `turtle-sleepy-stretch-flipper ${SLEEPY_STRETCH_FLIPPER_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'hungry-wiggle') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-hungry-wiggle-head-lift ${HUNGRY_WIGGLE_HEAD_DURATION_MS}ms ease-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-hungry-wiggle-flipper ${HUNGRY_WIGGLE_FLIPPER_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'playtime-welcome') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-playtime-welcome-head-lift ${PLAYTIME_WELCOME_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-playtime-welcome-flipper ${PLAYTIME_WELCOME_FLIPPER_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'encore') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-encore-head-lift ${ENCORE_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-encore-flipper ${ENCORE_FLIPPER_DURATION_MS}ms ease-in-out ${ENCORE_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'show-off') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-show-off-head-lift ${SHOW_OFF_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-left' || layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION[layer].origin,
          animation: `turtle-show-off-flipper ${SHOW_OFF_FLIPPER_DURATION_MS}ms ease-in-out ${SHOW_OFF_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'youre-here') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-youre-here-head-lift ${YOURE_HERE_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-youre-here-flipper ${YOURE_HERE_FLIPPER_DURATION_MS}ms ease-in-out ${YOURE_HERE_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'follow-me') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-follow-me-head ${FOLLOW_ME_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'happy-together') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-happy-together-head ${HAPPY_TOGETHER_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `turtle-happy-together-eyes ${HAPPY_TOGETHER_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'sleep-beside-you') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-sleep-beside-you-head ${SLEEP_BESIDE_YOU_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `turtle-sleep-beside-you-eyes ${SLEEP_BESIDE_YOU_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'sharing-time') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-sharing-time-head ${SHARING_TIME_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-sharing-time-flipper ${SHARING_TIME_FLIPPER_DURATION_MS}ms ease-in-out ${SHARING_TIME_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'explorer') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-explorer-head ${EXPLORER_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'curious-greeting') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-curious-greeting-head-extend ${WHOS_THERE_HEAD_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'what-was-that') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-what-was-that-head ${WHAT_WAS_THAT_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'warm-hello') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-warm-hello-head ${WARM_HELLO_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-warm-hello-flipper ${WARM_HELLO_FLIPPER_DURATION_MS}ms ease-in-out ${WARM_HELLO_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'thank-you') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-thank-you-head ${THANK_YOU_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-thank-you-flipper ${THANK_YOU_FLIPPER_DURATION_MS}ms ease-in-out ${THANK_YOU_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'peaceful-moment') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-peaceful-moment-head ${PEACEFUL_MOMENT_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `turtle-peaceful-moment-eyes ${PEACEFUL_MOMENT_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'drowsy-greeting') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-drowsy-greeting-head ${DROWSY_GREETING_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-left' || layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION[layer].origin,
          animation: `turtle-drowsy-greeting-flipper-stretch ${DROWSY_GREETING_FLIPPER_DURATION_MS}ms ease-in-out ${DROWSY_GREETING_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'cozy-time') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-cozy-time-head ${COZY_TIME_HEAD_DURATION_MS}ms ease-in-out 1 forwards`,
        }
      }

      if (layer === 'flipper-front-left' || layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION[layer].origin,
          animation: `turtle-cozy-time-flipper-relax ${COZY_TIME_FLIPPER_DURATION_MS}ms ease-in-out 1 forwards`,
        }
      }

      return {}
    }

    if (specialAnimation === 'power-nap') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-power-nap-head ${POWER_NAP_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `turtle-power-nap-eyes ${POWER_NAP_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'snack-check') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-snack-check-head ${SNACK_CHECK_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-snack-check-flipper ${SNACK_CHECK_FLIPPER_DURATION_MS}ms ease-in-out ${SNACK_CHECK_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'still-hungry') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-still-hungry-head ${STILL_HUNGRY_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-still-hungry-flipper ${STILL_HUNGRY_FLIPPER_DURATION_MS}ms ease-in-out ${STILL_HUNGRY_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'food-patrol') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '42% 58%',
          animation: `turtle-food-patrol-head ${FOOD_PATROL_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'flipper-front-right') {
        return {
          transformOrigin: FLIPPER_MOTION['flipper-front-right'].origin,
          animation: `turtle-food-patrol-flipper ${FOOD_PATROL_FLIPPER_DURATION_MS}ms ease-in-out ${FOOD_PATROL_FLIPPER_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    return {}
  }

  function getPettingWrapperStyle(layer) {
    if (!isPetting) return { transform: 'translate(0, 0) rotate(0deg)' }

    if (layer === 'head' || layer === pettingEyes || layer === pettingMouth) {
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
  // to neutral once isFeeding ends. Play: a soft happy paddle/bounce. All
  // live on this inner wrapper (not the outer pet-bob element) so they
  // never fight with the whole-body float. Purely visual — isFeeding is
  // still set the instant Feed is pressed, so this never delays the actual
  // action/persist/cooldown.
  const actionStyle = level1Animation === 'happy-bounce'
    ? { animation: `turtle-happy-bounce-body ${HAPPY_BOUNCE_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'hungry-wiggle'
    ? { animation: `turtle-hungry-wiggle-body ${HUNGRY_WIGGLE_BODY_DURATION_MS}ms ease-out 1` }
    : specialAnimation === 'encore'
    ? { animation: `turtle-encore-body ${ENCORE_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'show-off'
    ? { animation: `turtle-show-off-body ${SHOW_OFF_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'youre-here'
    ? { animation: `turtle-youre-here-body ${YOURE_HERE_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'follow-me'
    ? { animation: `turtle-follow-me-body ${FOLLOW_ME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'happy-together'
    ? { animation: `turtle-happy-together-body ${HAPPY_TOGETHER_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'sleep-beside-you'
    ? { animation: `turtle-sleep-beside-you-body ${SLEEP_BESIDE_YOU_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'sharing-time'
    ? { animation: `turtle-sharing-time-body ${SHARING_TIME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'explorer'
    ? { animation: `turtle-explorer-body ${EXPLORER_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'peaceful-moment'
    ? { animation: `turtle-peaceful-moment-body ${PEACEFUL_MOMENT_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'power-nap'
    ? { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }
    : isFeeding
    ? { animation: 'turtle-feed-anticipation 700ms ease-out 1 forwards' }
    : celebrationGreeting
      ? { animation: 'turtle-play-bounce 900ms ease-in-out 1' }
      : isPlaying
      ? { animation: 'turtle-play-bounce 1.4s ease-in-out 1' }
      : isReleasingFeed
        ? { animation: `turtle-feed-release ${FEED_RELEASE_DURATION_MS}ms ease-out 1 forwards` }
        : isPetting
          ? { animation: `turtle-petting-lean ${PETTING_REACTION_DURATION_MS}ms ease-out 1 forwards` }
        : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] ${sizeClass} -translate-x-1/2 -translate-y-1/2 ${bob}`}
      role="img"
      aria-label={`${name || 'Your turtle'}, mood: ${mood}`}
      style={bob ? { animationDelay: `${idleLoopDelays.bob}s` } : undefined}
    >
      <style>{TURTLE_KEYFRAMES}</style>
      <div
        className="relative aspect-[503/410] w-full drop-shadow-lg"
        style={actionStyle}
        onAnimationEnd={(event) => {
          if (attachmentAnimation && event.currentTarget === event.target) onAttachmentAnimationComplete?.()
        }}
      >
        {layers.map((layer, index) => (
          <span
            key={layer}
            className="absolute inset-0 block"
            style={{
              zIndex: index,
              ...getPettingWrapperStyle(layer),
              ...getIdleWrapperStyle(layer),
              ...getCelebrationWrapperStyle(layer),
            }}
          >
            <img
              src={petAssetPath('turtle', layer, colour)}
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
