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

function finLayerStyle(layer, jitterSeconds = 0, suppressAmbient = false) {
  const motion = FIN_MOTION[layer]
  if (!motion) return {}
  if (suppressAmbient) return { transformOrigin: motion.origin }
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
// Playful Level 1 "Happy Bounce" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a simple quick vertical body bob with
// minimal fin motion and no directional flourish. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const HAPPY_BOUNCE_BODY_DURATION_MS = 1900
const HAPPY_BOUNCE_FIN_DURATION_MS = 900
const HAPPY_BOUNCE_TAIL_DURATION_MS = 1100
// Curious Level 1 "Curious Peek" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a subtle forward lean, fins opening
// slightly, a small tilt toward the glass, then settle. One-shot, plays
// only inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const CURIOUS_PEEK_BODY_DURATION_MS = 1900
const CURIOUS_PEEK_FIN_DURATION_MS = 1000
// Gentle Level 1 "Happy Wave" personality-unlock celebration (see
// personalityUnlockAnimations.js) — one slow, friendly wave from a front
// fin (fin-front-right) and a tiny body acknowledgement, then settle.
// One-shot, plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const GENTLE_WAVE_BODY_DURATION_MS = 1600
const GENTLE_WAVE_FIN_DURATION_MS = 1500
// Sleepy Level 1 "Sleepy Stretch" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a slow body stretch, all fins unfurling
// slightly, and a gentle tail extension, then settle. One-shot, plays only
// inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const SLEEPY_STRETCH_BODY_DURATION_MS = 2500
const SLEEPY_STRETCH_FIN_DURATION_MS = 2000
const SLEEPY_STRETCH_TAIL_DURATION_MS = 2000
// Foodie Level 1 "Hungry Wiggle" personality-unlock celebration (see
// personalityUnlockAnimations.js) — two eager tail flicks, a brief fin
// flutter, and a tiny forward body lean, then settle. One-shot, plays only
// inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const HUNGRY_WIGGLE_BODY_DURATION_MS = 1700
const HUNGRY_WIGGLE_TAIL_DURATION_MS = 1300
const HUNGRY_WIGGLE_FIN_DURATION_MS = 900
// Playful Level 3 "Playtime Welcome" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a clear forward approach, a small fin
// opening, and a held stop facing forward. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const PLAYTIME_WELCOME_BODY_DURATION_MS = 1900
const PLAYTIME_WELCOME_TAIL_DURATION_MS = 1200
const PLAYTIME_WELCOME_FIN_DURATION_MS = 900
// Playful Level 5 "Encore!" personality-unlock celebration (see
// personalityUnlockAnimations.js) — two separated tail-led side-to-side
// beats with a visible pause between them; the body follows without a
// vertical bounce, before settling happy.
// Distinct from Level 1 Happy Bounce's single bob and Level 3 Playtime
// Welcome's greeting-like lean. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const ENCORE_BODY_DURATION_MS = 2400
const ENCORE_TAIL_DURATION_MS = 1500
const ENCORE_FIN_DURATION_MS = 850
const ENCORE_FIN_DELAY_MS = 350
// Playful Level 8 "Show Off" personality-unlock celebration (see
// personalityUnlockAnimations.js) — fins open proudly wider than normal,
// the body leans smoothly into a poised turn, one tail flourish follows,
// then a short proud pause before settling. Distinct from Encore's
// two-motion rhythm by reading as one polished performance. One-shot, plays
// only inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const SHOW_OFF_BODY_DURATION_MS = 2500
const SHOW_OFF_TAIL_DURATION_MS = 1300
const SHOW_OFF_TAIL_DELAY_MS = 400
const SHOW_OFF_FIN_DURATION_MS = 1400
// Playful Level 12 "You're Here!" personality-unlock celebration — a smooth
// strongest approach to the front, a long attentive hover with little
// flourish, then a gentle settle while staying focused forward. One-shot,
// plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const YOURE_HERE_BODY_DURATION_MS = 3200
const YOURE_HERE_TAIL_DURATION_MS = 850
const YOURE_HERE_FIN_DURATION_MS = 2600
const YOURE_HERE_TAIL_DELAY_MS = 950
// Curious Level 12 "Follow Me" personality-unlock celebration — acknowledges
// the player, glides to a point of interest, angles back toward the player,
// then holds briefly before settling. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const FOLLOW_ME_BODY_DURATION_MS = 3000
const FOLLOW_ME_FIN_DURATION_MS = 1100
// Gentle Level 12 "Happy Together" personality-unlock celebration — a slow
// front glide, relaxed fins, one gentle body sway, quiet hover, and calm
// settle. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const HAPPY_TOGETHER_BODY_DURATION_MS = 2800
const HAPPY_TOGETHER_FIN_DURATION_MS = 1500
// Sleepy Level 12 "Sleep Beside You" personality-unlock celebration — first
// glides toward the front, drifts lower into a resting hover, then rises
// gently to settle. One-shot, plays only inside PersonalityUnlockCelebration.jsx
// via the celebrationAnimation prop.
const SLEEP_BESIDE_YOU_BODY_DURATION_MS = 3300
const SLEEP_BESIDE_YOU_FIN_DURATION_MS = 1900
// Foodie Level 12 "Sharing Time" personality-unlock celebration — acknowledges
// the player, angles toward the feeding side, turns back for a hopeful hover,
// then settles. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const SHARING_TIME_BODY_DURATION_MS = 2800
const SHARING_TIME_FIN_DURATION_MS = 1200
// Curious Level 8 "Explorer" personality-unlock celebration (see
// personalityUnlockAnimations.js) — glides subtly toward one side,
// opens the fins a little, adds one brief inspecting tilt, holds a short
// investigative pause, then settles. Distinct from Who's There?'s
// greeting-like hover and What Was That's shorter reactive body tilt by
// reading as an intentional sideward inspection. One-shot, plays only
// inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const EXPLORER_BODY_DURATION_MS = 2500
const EXPLORER_FIN_DURATION_MS = 1400
// Curious Level 3 "Who's There?" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a small forward lean toward the glass
// that holds while rotating side to side (a curious tilt, distinct from
// Level 1 Curious Peek's single tilt), fins opening slightly with a held
// plateau, then settle facing forward. Longer overall durations than
// Curious Peek so the pause near the glass reads as longer. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const WHOS_THERE_BODY_DURATION_MS = 2600
const WHOS_THERE_FIN_DURATION_MS = 1500
// Curious Level 5 "What Was That?" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a brief still pause, then
// leans slightly forward into one modest side-to-side body tilt while the
// fins open a little, then settles facing forward. Distinct from Level 1
// Curious Peek's quicker immediate investigate and Level 3 Who's There?'s
// longer held curious hover near the glass. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const WHAT_WAS_THAT_BODY_DURATION_MS = 2300
const WHAT_WAS_THAT_FIN_DURATION_MS = 1000
// Gentle Level 3 "Warm Hello" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a tiny forward acknowledgement held
// clearly before easing back, then one slow front-fin wave (fin-front-
// right) that only starts after that acknowledgement has read (via
// animation-delay) and relaxes back to normal, then settle facing forward.
// Distinct from Level 1 Happy Wave, which starts its fin wave immediately
// alongside the body lean with no separate acknowledgement beat. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const WARM_HELLO_BODY_DURATION_MS = 2000
const WARM_HELLO_FIN_DURATION_MS = 1300
const WARM_HELLO_FIN_DELAY_MS = 700
// Gentle Level 5 "Thank You" personality-unlock celebration (see
// personalityUnlockAnimations.js) — starts with a tiny forward
// acknowledgement, then one slow front-fin wave, then eases into a slight
// relaxed settle. Distinct from Level 1 Happy Wave's simpler wave and Level
// 3 Warm Hello's held hello beat by using an acknowledge, wave, relax
// rhythm. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const THANK_YOU_BODY_DURATION_MS = 2200
const THANK_YOU_FIN_DURATION_MS = 1300
const THANK_YOU_FIN_DELAY_MS = 650
// Gentle Level 8 "Peaceful Moment" personality-unlock celebration (see
// personalityUnlockAnimations.js) — the fins relax outward slightly while
// the body makes one slow, breathing-like rock, then holds a brief still
// pause before settling. Calm and safe rather than sleepy. One-shot, plays
// only inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const PEACEFUL_MOMENT_BODY_DURATION_MS = 2500
const PEACEFUL_MOMENT_FIN_DURATION_MS = 1600
// Sleepy Level 3 "Drowsy Greeting" personality-unlock greeting (see
// personalityUnlockAnimations.js) — begins in a relaxed downward body
// angle (the 0% keyframe itself is the drooped pose, not neutral), holds
// there briefly as if still asleep, slowly lifts toward the glass, gently
// unfurling the fins as it wakes, then settle facing forward. Distinct
// from Level 1 Sleepy Stretch, which starts from the normal neutral pose
// and stretches outward rather than waking up from a lowered rest pose.
// One-shot, plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const DROWSY_GREETING_BODY_DURATION_MS = 2800
const DROWSY_GREETING_FIN_DURATION_MS = 1600
const DROWSY_GREETING_FIN_DELAY_MS = 1000
// Sleepy Level 5 "Cozy Time" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a gentle body stretch that eases into a
// calmer resting pose, with fins relaxing outward slightly and the tail
// settling into a softer resting motion. Distinct from Level 1 Sleepy
// Stretch's more obvious stretch and Level 3 Drowsy Greeting's waking
// acknowledgement. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const COZY_TIME_BODY_DURATION_MS = 2600
const COZY_TIME_FIN_DURATION_MS = 1700
const COZY_TIME_TAIL_DURATION_MS = 1500
const COZY_TIME_TAIL_DELAY_MS = 700
// Sleepy Level 8 "Power Nap" personality-unlock celebration (see
// personalityUnlockAnimations.js) — drifts downward slightly while the
// fins relax, holds a short resting pose, then gently rises back up and
// settles. Distinct from Cozy Time's settled comfort by reading as a brief
// doze. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const POWER_NAP_BODY_DURATION_MS = 2900
const POWER_NAP_FIN_DURATION_MS = 2100
// Foodie Level 3 "Snack Check" personality-unlock greeting (see
// personalityUnlockAnimations.js) — first leans slightly toward the
// player, then angles toward the feeding area for a clear food-check beat,
// with one small tail flick and a light fin flutter starting only during
// that second beat, then settle facing forward. Distinct from Level 1
// Hungry Wiggle, which reads as immediate eager motion instead of a
// deliberate two-step greeting. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SNACK_CHECK_BODY_DURATION_MS = 2300
const SNACK_CHECK_TAIL_DURATION_MS = 900
const SNACK_CHECK_TAIL_DELAY_MS = 950
const SNACK_CHECK_FIN_DURATION_MS = 850
const SNACK_CHECK_FIN_DELAY_MS = 1050
// Foodie Level 5 "Still Hungry" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a small satisfied settle,
// pauses briefly, then angles hopefully toward the feeding area with one
// small tail flick and a light fin flutter, then settles forward again.
// Distinct from Level 1 Hungry Wiggle's immediate eagerness and Level 3
// Snack Check's player-first greeting by reading as quiet hopeful interest
// after already having been fed. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const STILL_HUNGRY_BODY_DURATION_MS = 2600
const STILL_HUNGRY_TAIL_DURATION_MS = 900
const STILL_HUNGRY_TAIL_DELAY_MS = 1350
const STILL_HUNGRY_FIN_DURATION_MS = 850
const STILL_HUNGRY_FIN_DELAY_MS = 1450
// Foodie Level 8 "Food Patrol" personality-unlock celebration (see
// personalityUnlockAnimations.js) — leans smoothly toward the feeding side,
// holds a brief hopeful pause, then adds one small tail flick and a light
// fin flutter before calmly settling. Distinct from Snack Check's greeting
// beat and Still Hungry's post-meal yearning by reading as a quiet patrol
// of the food area. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const FOOD_PATROL_BODY_DURATION_MS = 2500
const FOOD_PATROL_TAIL_DURATION_MS = 850
const FOOD_PATROL_TAIL_DELAY_MS = 1150
const FOOD_PATROL_FIN_DURATION_MS = 800
const FOOD_PATROL_FIN_DELAY_MS = 1225

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

function getBettaFaceState(mood, stats, expression, isEating) {
  if (isEating) return { eyes: 'eyes-open', mouth: 'mouth-eating', canBlink: false }
  if (expression === PET_EXPRESSIONS.happy) return { eyes: 'eyes-open', mouth: 'mouth-happy', canBlink: true }

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
@keyframes betta-happy-bounce-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  14% { transform: translate(0, 2.2%) rotate(0deg) scale(0.99); }
  30% { transform: translate(-0.8%, -10.5%) rotate(-3deg) scale(1.015); }
  42% { transform: translate(-1%, -12%) rotate(-3.5deg) scale(1.02); }
  56% { transform: translate(0, -2.5%) rotate(0deg) scale(1.006); }
  68% { transform: translate(0, 0.8%) rotate(0deg) scale(0.998); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-happy-bounce-fin-spread {
  0%, 100% { transform: scale(1) rotate(0deg); }
  34% { transform: scale(1.1) rotate(-2deg); }
  58% { transform: scale(1.04) rotate(-0.5deg); }
}
@keyframes betta-curious-peek-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  34% { transform: translate(-1.8%, -0.3%) rotate(-3deg) scale(1.012); }
  70% { transform: translate(-0.7%, -0.1%) rotate(-1deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-curious-peek-fin-open {
  0%, 100% { transform: scale(1) rotate(0deg); }
  45% { transform: scale(1.06) rotate(-2deg); }
  75% { transform: scale(1.02) rotate(-0.5deg); }
}
@keyframes betta-gentle-wave-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  35% { transform: translate(0, -0.4%) rotate(-1deg) scale(1.004); }
  75% { transform: translate(0, -0.1%) rotate(-0.3deg) scale(1.001); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-gentle-wave-fin {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-12deg); }
  50% { transform: rotate(9deg); }
  75% { transform: rotate(-5deg); }
}
@keyframes betta-sleepy-stretch-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  40% { transform: translate(0, -0.2%) rotate(0.5deg) scale(1.02); }
  75% { transform: translate(0, -0.05%) rotate(0.2deg) scale(1.006); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-sleepy-stretch-fin-unfurl {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.05) rotate(1deg); }
  80% { transform: scale(1.015) rotate(0.3deg); }
}
@keyframes betta-sleepy-stretch-tail-extend {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.06) rotate(3deg); }
  80% { transform: scale(1.02) rotate(1deg); }
}
@keyframes betta-hungry-wiggle-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  30% { transform: translate(-1.2%, -0.2%) rotate(-2deg) scale(1.01); }
  65% { transform: translate(-0.4%, -0.05%) rotate(-0.6deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-hungry-wiggle-tail-flick {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(13deg); }
  40% { transform: rotate(-9deg); }
  60% { transform: rotate(10deg); }
  80% { transform: rotate(-6deg); }
}
@keyframes betta-hungry-wiggle-fin-flutter {
  0%, 100% { transform: scale(1) rotate(0deg); }
  40% { transform: scale(1.05) rotate(-3deg); }
  70% { transform: scale(1.015) rotate(1deg); }
}
@keyframes betta-playtime-welcome-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  12% { transform: translate(-0.8%, 0) rotate(-1deg) scale(1.002); }
  30% { transform: translate(-3.8%, -0.2%) rotate(-1.5deg) scale(1.01); }
  48% { transform: translate(-6%, -0.3%) rotate(-1deg) scale(1.018); }
  64% { transform: translate(-6%, -0.3%) rotate(-1deg) scale(1.018); }
  80% { transform: translate(-4.5%, -0.2%) rotate(-0.5deg) scale(1.01); }
  92% { transform: translate(-1.8%, 0) rotate(0deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-playtime-welcome-fin-flutter {
  0%, 100% { transform: scale(1) rotate(0deg); }
  42% { transform: scale(1.12) rotate(-2deg); }
  68% { transform: scale(1.04) rotate(0deg); }
}
@keyframes betta-encore-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  10% { transform: translate(1%, 0) rotate(1deg) scale(1.002); }
  24% { transform: translate(5.5%, 0) rotate(4deg) scale(1.012); }
  38% { transform: translate(0, 0) rotate(0deg) scale(1); }
  46%, 52% { transform: translate(0, 0) rotate(0deg) scale(1); }
  66% { transform: translate(-5.5%, 0) rotate(-4deg) scale(1.012); }
  80% { transform: translate(0, 0) rotate(0deg) scale(1); }
  88% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-encore-tail-flick {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(8deg); }
  24% { transform: rotate(22deg); }
  38%, 52% { transform: rotate(0deg); }
  66% { transform: rotate(-22deg); }
  80%, 88% { transform: rotate(0deg); }
}
@keyframes betta-encore-fin-flutter {
  0%, 100% { transform: scale(1) rotate(0deg); }
  30% { transform: scale(1.035) rotate(-1deg); }
  70% { transform: scale(1.015) rotate(0deg); }
}
@keyframes betta-show-off-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  12% { transform: translate(-0.6%, -0.2%) rotate(-2deg) scale(1.004); }
  28% { transform: translate(-2%, -0.7%) rotate(-8deg) scale(1.018); }
  44% { transform: translate(-2.5%, -1%) rotate(-11deg) scale(1.03); }
  62% { transform: translate(-2.5%, -1%) rotate(-11deg) scale(1.03); }
  76% { transform: translate(-1.8%, -0.5%) rotate(-7deg) scale(1.018); }
  90% { transform: translate(-0.6%, -0.1%) rotate(-2deg) scale(1.004); }
}
@keyframes betta-show-off-tail-flourish {
  0%, 100% { transform: rotate(0deg); }
  16% { transform: rotate(5deg); }
  32% { transform: rotate(24deg); }
  48% { transform: rotate(5deg); }
  62% { transform: rotate(-15deg); }
  76% { transform: rotate(5deg); }
  90% { transform: rotate(1deg); }
}
@keyframes betta-show-off-fin-open {
  0%, 100% { transform: scale(1) rotate(0deg); }
  28% { transform: scale(1.18) rotate(-4deg); }
  52% { transform: scale(1.22) rotate(-3deg); }
  76% { transform: scale(1.08) rotate(-0.5deg); }
}
@keyframes betta-youre-here-body {
  0% { transform: translate(0, 0) rotate(0deg); }
  8% { transform: translate(0.7%, 0) rotate(2deg); }
  16% { transform: translate(0.7%, 0) rotate(2deg); }
  25% { transform: translate(-1.5%, 0) rotate(0deg); }
  38% { transform: translate(-5.8%, 0) rotate(-2deg); }
  48% { transform: translate(-8.4%, 0) rotate(-4deg); }
  54% { transform: translate(-7.8%, 0) rotate(-6.5deg); }
  62% { transform: translate(-7.8%, 0) rotate(-7deg); }
  68% { transform: translate(-7.8%, 0) rotate(-7deg); }
  82% { transform: translate(-5.5%, 0) rotate(-4deg); }
  94% { transform: translate(-2%, 0) rotate(-1.5deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes betta-youre-here-tail-flourish {
  0%, 100% { transform: rotate(0deg); }
  42%, 68% { transform: rotate(0deg); }
}
@keyframes betta-youre-here-fin-open {
  0%, 100% { transform: scale(1) rotate(0deg); }
  45% { transform: scale(1.03) rotate(-0.5deg); }
  60% { transform: scale(1.06) rotate(-1deg); }
  72% { transform: scale(1.06) rotate(-1deg); }
  88% { transform: scale(1.03) rotate(-0.5deg); }
}
@keyframes betta-follow-me-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  16% { transform: translate(-0.9%, -0.3%) rotate(-2deg) scale(1.008); }
  40% { transform: translate(-2.8%, -0.1%) rotate(-1deg) scale(1.012); }
  60% { transform: translate(-2.8%, -0.1%) rotate(-1deg) scale(1.012); }
  74% { transform: translate(0.4%, -0.05%) rotate(1.8deg) scale(1.006); }
  88% { transform: translate(0.4%, -0.05%) rotate(1.8deg) scale(1.006); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-follow-me-fin-angle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  42% { transform: scale(1.045) rotate(-2deg); }
  72% { transform: scale(1.03) rotate(2deg); }
  88% { transform: scale(1.01) rotate(1deg); }
}
@keyframes betta-happy-together-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(-1.8%, -0.12%) rotate(-0.8deg) scale(1.008); }
  48% { transform: translate(-1.8%, -0.12%) rotate(-0.8deg) scale(1.008); }
  62% { transform: translate(-1.5%, 0.08%) rotate(0.9deg) scale(1.005); }
  76% { transform: translate(-1.8%, -0.12%) rotate(-0.8deg) scale(1.008); }
  90% { transform: translate(-0.25%, -0.02%) rotate(-0.1deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-happy-together-fin-relax {
  0%, 100% { transform: scale(1) rotate(0deg); }
  38% { transform: scale(1.035) rotate(-0.8deg); }
  58% { transform: scale(1.05) rotate(-0.5deg); }
  78% { transform: scale(1.025) rotate(-0.2deg); }
}
@keyframes betta-sleep-beside-you-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(-1.1%, -0.18%) rotate(-0.8deg) scale(1.006); }
  44% { transform: translate(-1.8%, -0.05%) rotate(-0.5deg) scale(1.008); }
  62% { transform: translate(-1.8%, 0.65%) rotate(0.8deg) scale(1.002); }
  78% { transform: translate(-1.8%, 0.65%) rotate(0.8deg) scale(1.002); }
  91% { transform: translate(-0.3%, -0.1%) rotate(-0.15deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-sleep-beside-you-fin-relax {
  0%, 100% { transform: scale(1) rotate(0deg); }
  38% { transform: scale(1.035) rotate(-0.8deg); }
  62% { transform: scale(1.055) rotate(-0.4deg); }
  82% { transform: scale(1.025) rotate(-0.1deg); }
}
@keyframes betta-sharing-time-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  16% { transform: translate(-0.8%, -0.3%) rotate(-1.8deg) scale(1.006); }
  38% { transform: translate(2%, -0.08%) rotate(2.4deg) scale(1.01); }
  56% { transform: translate(2%, -0.08%) rotate(2.4deg) scale(1.01); }
  70% { transform: translate(-0.35%, -0.03%) rotate(-1.6deg) scale(1.004); }
  86% { transform: translate(-0.35%, -0.03%) rotate(-1.6deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-sharing-time-fin-relax {
  0%, 100% { transform: scale(1) rotate(0deg); }
  40% { transform: scale(1.025) rotate(1.5deg); }
  58% { transform: scale(1.04) rotate(1deg); }
  76% { transform: scale(1.018) rotate(-0.5deg); }
}
@keyframes betta-explorer-body {
  0%, 14% { transform: translate(0, 0) rotate(0deg) scale(1); }
  36% { transform: translate(-1.9%, -0.24%) rotate(-3.1deg) scale(1.012); }
  54% { transform: translate(-1.9%, -0.24%) rotate(2.1deg) scale(1.012); }
  72% { transform: translate(-1.9%, -0.24%) rotate(-1.2deg) scale(1.01); }
  88% { transform: translate(-0.45%, -0.05%) rotate(-0.4deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-explorer-fin-open {
  0%, 14%, 100% { transform: scale(1) rotate(0deg); }
  40% { transform: scale(1.06) rotate(-2deg); }
  62% { transform: scale(1.08) rotate(-1.2deg); }
  82% { transform: scale(1.03) rotate(-0.4deg); }
}
@keyframes betta-curious-greeting-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(-1.6%, -0.3%) rotate(-3deg) scale(1.01); }
  45% { transform: translate(-1.6%, -0.3%) rotate(3deg) scale(1.01); }
  65% { transform: translate(-1.4%, -0.25%) rotate(-2deg) scale(1.008); }
  85% { transform: translate(-0.5%, -0.1%) rotate(0.5deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-curious-greeting-fin-open {
  0%, 100% { transform: scale(1) rotate(0deg); }
  35% { transform: scale(1.06) rotate(-2deg); }
  65% { transform: scale(1.06) rotate(-2deg); }
  85% { transform: scale(1.02) rotate(-0.5deg); }
}
@keyframes betta-what-was-that-body {
  0%, 16% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(-1.4%, -0.2%) rotate(-2.2deg) scale(1.01); }
  60% { transform: translate(-1.4%, -0.2%) rotate(2.2deg) scale(1.01); }
  80% { transform: translate(-0.5%, -0.06%) rotate(-0.5deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-what-was-that-fin-open {
  0%, 18%, 100% { transform: scale(1) rotate(0deg); }
  48% { transform: scale(1.05) rotate(-1.8deg); }
  72% { transform: scale(1.02) rotate(-0.4deg); }
}
@keyframes betta-warm-hello-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  30% { transform: translate(-1.5%, -0.25%) rotate(-2.5deg) scale(1.01); }
  50% { transform: translate(-1.5%, -0.25%) rotate(-2.5deg) scale(1.01); }
  75% { transform: translate(-0.3%, -0.05%) rotate(-0.5deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-warm-hello-fin-wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-11deg); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-4deg); }
}
@keyframes betta-thank-you-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(-1.1%, -0.18%) rotate(-1.8deg) scale(1.008); }
  42% { transform: translate(-1.1%, -0.18%) rotate(-1.8deg) scale(1.008); }
  74% { transform: translate(-0.25%, 0.08%) rotate(0.7deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-thank-you-fin-wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  50% { transform: rotate(7deg); }
  75% { transform: rotate(-4deg); }
}
@keyframes betta-peaceful-moment-body {
  0%, 16% { transform: translate(0, 0) rotate(0deg) scale(1); }
  40% { transform: translate(0.15%, -0.2%) rotate(1.5deg) scale(1.008); }
  58% { transform: translate(0.15%, -0.2%) rotate(1.5deg) scale(1.008); }
  80% { transform: translate(0.02%, -0.04%) rotate(0.35deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-peaceful-moment-fin-relax {
  0%, 18%, 100% { transform: scale(1) rotate(0deg); }
  42% { transform: scale(1.05) rotate(-1.4deg); }
  60% { transform: scale(1.07) rotate(-1deg); }
  82% { transform: scale(1.02) rotate(-0.2deg); }
}
@keyframes betta-drowsy-greeting-body {
  0% { transform: translate(0, 0.8%) rotate(4deg) scale(0.996); }
  15% { transform: translate(0, 0.8%) rotate(4deg) scale(0.996); }
  55% { transform: translate(-1%, -0.2%) rotate(-2deg) scale(1.008); }
  80% { transform: translate(-0.3%, -0.05%) rotate(-0.5deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-drowsy-greeting-fin-unfurl {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.05) rotate(1deg); }
  80% { transform: scale(1.015) rotate(0.3deg); }
}
@keyframes betta-cozy-time-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  34% { transform: translate(0, -0.16%) rotate(0.35deg) scale(1.018); }
  70% { transform: translate(0, 0.22%) rotate(0.9deg) scale(0.998); }
  100% { transform: translate(0, 0.2%) rotate(0.8deg) scale(0.998); }
}
@keyframes betta-cozy-time-fin-relax {
  0%, 100% { transform: scale(1) rotate(0deg); }
  48% { transform: scale(1.04) rotate(0.8deg); }
  82% { transform: scale(1.02) rotate(0.3deg); }
}
@keyframes betta-cozy-time-tail-settle {
  0%, 100% { transform: rotate(0deg); }
  42% { transform: rotate(6deg); }
  78% { transform: rotate(2deg); }
}
@keyframes betta-power-nap-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(0, 1.25%) rotate(2deg) scale(0.998); }
  58% { transform: translate(0, 1.25%) rotate(2deg) scale(0.998); }
  84% { transform: translate(0, 0.18%) rotate(0.35deg) scale(1); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-power-nap-fin-relax {
  0%, 100% { transform: scale(1) rotate(0deg); }
  32% { transform: scale(1.035) rotate(0.7deg); }
  58% { transform: scale(1.045) rotate(0.8deg); }
  84% { transform: scale(1.012) rotate(0.18deg); }
}
@keyframes betta-snack-check-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  20% { transform: translate(-1.3%, -0.25%) rotate(-2.2deg) scale(1.01); }
  36% { transform: translate(-1.3%, -0.25%) rotate(-2.2deg) scale(1.01); }
  60% { transform: translate(1%, 0.1%) rotate(2.8deg) scale(1.008); }
  78% { transform: translate(1%, 0.1%) rotate(2.8deg) scale(1.008); }
  92% { transform: translate(0.2%, 0.02%) rotate(0.6deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-snack-check-tail-flick {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(10deg); }
  65% { transform: rotate(-6deg); }
}
@keyframes betta-snack-check-fin-flutter {
  0%, 100% { transform: scale(1) rotate(0deg); }
  38% { transform: scale(1.04) rotate(-2deg); }
  72% { transform: scale(1.012) rotate(0.8deg); }
}
@keyframes betta-still-hungry-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  18% { transform: translate(0, 0.18%) rotate(0.5deg) scale(0.996); }
  32% { transform: translate(0, 0.18%) rotate(0.5deg) scale(0.996); }
  48% { transform: translate(0, 0.18%) rotate(0.5deg) scale(0.996); }
  70% { transform: translate(1.15%, 0.06%) rotate(2.3deg) scale(1.008); }
  84% { transform: translate(1.15%, 0.06%) rotate(2.3deg) scale(1.008); }
  94% { transform: translate(0.22%, 0.02%) rotate(0.6deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-still-hungry-tail-flick {
  0%, 100% { transform: rotate(0deg); }
  36% { transform: rotate(8deg); }
  68% { transform: rotate(-5deg); }
}
@keyframes betta-still-hungry-fin-flutter {
  0%, 100% { transform: scale(1) rotate(0deg); }
  42% { transform: scale(1.03) rotate(-1.5deg); }
  74% { transform: scale(1.01) rotate(0.6deg); }
}
@keyframes betta-food-patrol-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(1.15%, 0.06%) rotate(2.2deg) scale(1.008); }
  48% { transform: translate(1.15%, 0.06%) rotate(2.2deg) scale(1.008); }
  72% { transform: translate(1.15%, 0.06%) rotate(2.2deg) scale(1.008); }
  90% { transform: translate(0.2%, 0.02%) rotate(0.5deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes betta-food-patrol-tail-flick {
  0%, 100% { transform: rotate(0deg); }
  36% { transform: rotate(8deg); }
  68% { transform: rotate(-4deg); }
}
@keyframes betta-food-patrol-fin-flutter {
  0%, 100% { transform: scale(1) rotate(0deg); }
  40% { transform: scale(1.03) rotate(-1.6deg); }
  72% { transform: scale(1.01) rotate(0.6deg); }
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
  const isPlayfulBettaMilestone = celebrationAnimation === 'happy-bounce'
    || celebrationAnimation === 'playtime-welcome'
    || celebrationAnimation === 'encore'
    || celebrationAnimation === 'show-off'
    || celebrationAnimation === 'youre-here'
  const bob = mood === 'happy' && !isPlayfulBettaMilestone ? 'animate-pet-bob motion-ambient' : ''
  const sizeClass = isCelebrationMode
    ? 'w-[clamp(12rem,62vw,25rem)] sm:w-[clamp(15rem,55vw,31rem)] md:w-[clamp(18rem,44vw,37rem)]'
    : 'w-[clamp(4.75rem,26%,6.5rem)] sm:w-[clamp(5.5rem,24%,8rem)] md:w-[clamp(6rem,20%,14rem)]'
  const isEatingHeld = useExtendedEating(isEating)
  const face = getBettaFaceState(mood, stats, expression, isEatingHeld)
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
    && !isEating
    && !isReleasingFeed
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
  const suppressPlayfulBettaAmbient = isPlayfulBettaMilestone
    || level1Animation === 'happy-bounce'
    || specialAnimation === 'playtime-welcome'
    || specialAnimation === 'encore'
  const effectiveLastPettedAt = optimisticLastPettedAt ?? lastPettedAt
  const lastPettedMs = effectiveLastPettedAt ? new Date(effectiveLastPettedAt).getTime() : Number.NaN
  const isPettingAvailable = !Number.isFinite(lastPettedMs) || (pettingAvailabilityNowMs - lastPettedMs) >= PETTING_COOLDOWN_MS
  const canPet = !isCelebrationMode
    && !isFeeding
    && !isPlaying
    && !isCleaning
    && !isEating
    && !isReleasingFeed
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
        const fallbackAnimation = Math.random() < 0.5 ? 'fin-flare' : 'body-sway'
        const nextAnimation = selectIdleAnimation({
          species: 'betta',
          earnedPersonalityUnlockKeys,
          fallbackAnimation,
          suppressFoodPatrol: suppressFoodPatrolRef.current,
        })
        suppressFoodPatrolRef.current = false
        const durationMs = nextAnimation === 'fin-flare'
          ? IDLE_FIN_FLARE_DURATION_MS
          : nextAnimation === 'happy-bounce'
          ? HAPPY_BOUNCE_BODY_DURATION_MS
          : nextAnimation === 'curious-peek'
          ? CURIOUS_PEEK_BODY_DURATION_MS
          : nextAnimation === 'gentle-wave'
          ? GENTLE_WAVE_BODY_DURATION_MS
          : nextAnimation === 'sleepy-stretch'
          ? SLEEPY_STRETCH_BODY_DURATION_MS
          : nextAnimation === 'hungry-wiggle'
          ? HUNGRY_WIGGLE_BODY_DURATION_MS
          : nextAnimation === 'show-off'
          ? SHOW_OFF_BODY_DURATION_MS
          : nextAnimation === 'explorer'
          ? EXPLORER_BODY_DURATION_MS
          : nextAnimation === 'peaceful-moment'
          ? PEACEFUL_MOMENT_BODY_DURATION_MS
          : nextAnimation === 'power-nap'
          ? POWER_NAP_BODY_DURATION_MS
          : nextAnimation === 'food-patrol'
          ? FOOD_PATROL_BODY_DURATION_MS
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

  const isBlinking = useIdleBlink(
    !isCelebrationMode
    && face.canBlink
    && !isCleaning
    && !isReleasingFeed
    && !activeIdleAnimation
    && !isPetting
    && !actionReactionAnimation
    && !attachmentAnimation,
  )
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

  function getCelebrationWrapperStyle(layer) {
    if (level1Animation === 'happy-bounce') {
      if (layer === 'fin-front-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-happy-bounce-fin-spread ${HAPPY_BOUNCE_FIN_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'curious-peek') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-curious-peek-fin-open ${CURIOUS_PEEK_FIN_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'gentle-wave') {
      if (layer === 'fin-front-right') {
        return {
          transformOrigin: FIN_MOTION['fin-front-right'].origin,
          animation: `betta-gentle-wave-fin ${GENTLE_WAVE_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'sleepy-stretch') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-sleepy-stretch-tail-extend ${SLEEPY_STRETCH_TAIL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-sleepy-stretch-fin-unfurl ${SLEEPY_STRETCH_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'hungry-wiggle') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-hungry-wiggle-tail-flick ${HUNGRY_WIGGLE_TAIL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-hungry-wiggle-fin-flutter ${HUNGRY_WIGGLE_FIN_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'playtime-welcome') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-playtime-welcome-fin-flutter ${PLAYTIME_WELCOME_FIN_DURATION_MS}ms cubic-bezier(0.22, 0.75, 0.3, 1) 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'encore') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-encore-tail-flick ${ENCORE_TAIL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'show-off') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-show-off-tail-flourish ${SHOW_OFF_TAIL_DURATION_MS}ms ease-in-out ${SHOW_OFF_TAIL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-show-off-fin-open ${SHOW_OFF_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'youre-here') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-youre-here-tail-flourish ${YOURE_HERE_TAIL_DURATION_MS}ms ease-in-out ${YOURE_HERE_TAIL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-youre-here-fin-open ${YOURE_HERE_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'follow-me') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-follow-me-fin-angle ${FOLLOW_ME_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'happy-together') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-happy-together-fin-relax ${HAPPY_TOGETHER_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'sleep-beside-you') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-sleep-beside-you-fin-relax ${SLEEP_BESIDE_YOU_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'sharing-time') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-sharing-time-fin-relax ${SHARING_TIME_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'explorer') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-explorer-fin-open ${EXPLORER_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'curious-greeting') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-curious-greeting-fin-open ${WHOS_THERE_FIN_DURATION_MS}ms ease-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'what-was-that') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-what-was-that-fin-open ${WHAT_WAS_THAT_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'warm-hello') {
      if (layer === 'fin-front-right') {
        return {
          transformOrigin: FIN_MOTION['fin-front-right'].origin,
          animation: `betta-warm-hello-fin-wave ${WARM_HELLO_FIN_DURATION_MS}ms ease-in-out ${WARM_HELLO_FIN_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'thank-you') {
      if (layer === 'fin-front-right') {
        return {
          transformOrigin: FIN_MOTION['fin-front-right'].origin,
          animation: `betta-thank-you-fin-wave ${THANK_YOU_FIN_DURATION_MS}ms ease-in-out ${THANK_YOU_FIN_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'peaceful-moment') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-peaceful-moment-fin-relax ${PEACEFUL_MOMENT_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'drowsy-greeting') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-drowsy-greeting-fin-unfurl ${DROWSY_GREETING_FIN_DURATION_MS}ms ease-in-out ${DROWSY_GREETING_FIN_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'cozy-time') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-cozy-time-tail-settle ${COZY_TIME_TAIL_DURATION_MS}ms ease-in-out ${COZY_TIME_TAIL_DELAY_MS}ms 1 forwards`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-cozy-time-fin-relax ${COZY_TIME_FIN_DURATION_MS}ms ease-in-out 1 forwards`,
        }
      }

      return {}
    }

    if (specialAnimation === 'power-nap') {
      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-power-nap-fin-relax ${POWER_NAP_FIN_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'snack-check') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-snack-check-tail-flick ${SNACK_CHECK_TAIL_DURATION_MS}ms ease-in-out ${SNACK_CHECK_TAIL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-snack-check-fin-flutter ${SNACK_CHECK_FIN_DURATION_MS}ms ease-out ${SNACK_CHECK_FIN_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'still-hungry') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-still-hungry-tail-flick ${STILL_HUNGRY_TAIL_DURATION_MS}ms ease-in-out ${STILL_HUNGRY_TAIL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-still-hungry-fin-flutter ${STILL_HUNGRY_FIN_DURATION_MS}ms ease-out ${STILL_HUNGRY_FIN_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'food-patrol') {
      if (layer === 'tail') {
        return {
          transformOrigin: FIN_MOTION.tail.origin,
          animation: `betta-food-patrol-tail-flick ${FOOD_PATROL_TAIL_DURATION_MS}ms ease-in-out ${FOOD_PATROL_TAIL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'fin-top' || layer === 'fin-bottom' || layer === 'fin-side-left' || layer === 'fin-side-right') {
        return {
          transformOrigin: FIN_MOTION[layer].origin,
          animation: `betta-food-patrol-fin-flutter ${FOOD_PATROL_FIN_DURATION_MS}ms ease-out ${FOOD_PATROL_FIN_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    return {}
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
  const actionStyle = level1Animation === 'happy-bounce'
    ? { animation: `betta-happy-bounce-body ${HAPPY_BOUNCE_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'curious-peek'
    ? { animation: `betta-curious-peek-body ${CURIOUS_PEEK_BODY_DURATION_MS}ms ease-out 1` }
    : level1Animation === 'gentle-wave'
    ? { animation: `betta-gentle-wave-body ${GENTLE_WAVE_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'sleepy-stretch'
    ? { animation: `betta-sleepy-stretch-body ${SLEEPY_STRETCH_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'hungry-wiggle'
    ? { animation: `betta-hungry-wiggle-body ${HUNGRY_WIGGLE_BODY_DURATION_MS}ms ease-out 1` }
    : specialAnimation === 'playtime-welcome'
    ? { animation: `betta-playtime-welcome-body ${PLAYTIME_WELCOME_BODY_DURATION_MS}ms cubic-bezier(0.22, 0.75, 0.3, 1) 1` }
    : specialAnimation === 'encore'
    ? { animation: `betta-encore-body ${ENCORE_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'show-off'
    ? { animation: `betta-show-off-body ${SHOW_OFF_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'youre-here'
    ? { animation: `betta-youre-here-body ${YOURE_HERE_BODY_DURATION_MS}ms cubic-bezier(0.18, 0.82, 0.28, 1) 1` }
    : specialAnimation === 'follow-me'
    ? { animation: `betta-follow-me-body ${FOLLOW_ME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'happy-together'
    ? { animation: `betta-happy-together-body ${HAPPY_TOGETHER_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'sleep-beside-you'
    ? { animation: `betta-sleep-beside-you-body ${SLEEP_BESIDE_YOU_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'sharing-time'
    ? { animation: `betta-sharing-time-body ${SHARING_TIME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'explorer'
    ? { animation: `betta-explorer-body ${EXPLORER_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'curious-greeting'
    ? { animation: `betta-curious-greeting-body ${WHOS_THERE_BODY_DURATION_MS}ms ease-out 1` }
    : specialAnimation === 'what-was-that'
    ? { animation: `betta-what-was-that-body ${WHAT_WAS_THAT_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'warm-hello'
    ? { animation: `betta-warm-hello-body ${WARM_HELLO_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'thank-you'
    ? { animation: `betta-thank-you-body ${THANK_YOU_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'peaceful-moment'
    ? { animation: `betta-peaceful-moment-body ${PEACEFUL_MOMENT_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'drowsy-greeting'
    ? { animation: `betta-drowsy-greeting-body ${DROWSY_GREETING_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'cozy-time'
    ? { animation: `betta-cozy-time-body ${COZY_TIME_BODY_DURATION_MS}ms ease-in-out 1 forwards` }
    : specialAnimation === 'power-nap'
    ? { animation: `betta-power-nap-body ${POWER_NAP_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'snack-check'
    ? { animation: `betta-snack-check-body ${SNACK_CHECK_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'still-hungry'
    ? { animation: `betta-still-hungry-body ${STILL_HUNGRY_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'food-patrol'
    ? { animation: `betta-food-patrol-body ${FOOD_PATROL_BODY_DURATION_MS}ms ease-in-out 1` }
    : isFeeding
    ? { animation: 'betta-feed-anticipation 700ms ease-out 1 forwards' }
    : celebrationGreeting
      ? { animation: 'betta-play-wiggle 900ms ease-in-out 1' }
      : isPlaying
      ? { animation: 'betta-play-wiggle 1.4s ease-in-out 1' }
      : isReleasingFeed
        ? { animation: `betta-feed-release ${FEED_RELEASE_DURATION_MS}ms ease-out 1 forwards` }
        : isPetting
          ? { animation: `betta-petting-sway ${PETTING_REACTION_DURATION_MS}ms ease-out 1 forwards` }
        : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] ${sizeClass} -translate-x-1/2 -translate-y-1/2 ${bob}`}
      role="img"
      aria-label={`${name || 'Your betta'}, mood: ${mood}`}
      style={bob ? { animationDelay: `${idleLoopDelays.bob}s` } : undefined}
    >
      <style>{BETTA_KEYFRAMES}</style>
      <div
        className="relative aspect-[586/488] w-full drop-shadow-lg"
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
              src={petAssetPath('betta', layer, colour)}
              alt=""
              className="absolute inset-0 h-full w-full motion-ambient"
              style={finLayerStyle(layer, idleLoopDelays[layer] ?? 0, suppressPlayfulBettaAmbient)}
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
