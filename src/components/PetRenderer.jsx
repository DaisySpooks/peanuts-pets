import { useEffect, useRef, useState } from 'react'
import { petAssetPath } from './petAssetPath.js'
import { playPet, playAffection } from '../lib/audio.js'
import {
  isLevel1PersonalityIdleAnimation,
  isLevel8PersonalityIdleAnimation,
  selectIdleAnimation,
} from './personalityIdleSelection.js'
import { PET_EXPRESSIONS } from './useTemporaryExpression.js'

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
function getAxolotlFaceState(mood, stats, expression, isEating) {
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
// Playful Level 1 "Happy Bounce" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a tiny upward hop, a gill wiggle, one
// tail swish, then settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const HAPPY_BOUNCE_BODY_DURATION_MS = 2000
const HAPPY_BOUNCE_GILL_DURATION_MS = 900
const HAPPY_BOUNCE_TAIL_DURATION_MS = 900
// Curious Level 1 "Curious Peek" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a small forward lean, a gentle head
// tilt, a brief gill twitch, then settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const CURIOUS_PEEK_BODY_DURATION_MS = 1900
const CURIOUS_PEEK_HEAD_DURATION_MS = 1000
const CURIOUS_PEEK_GILL_DURATION_MS = 550
// Gentle Level 1 "Happy Wave" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a tiny body acknowledgement and one
// small front-paw wave (leg-front-right, the same layer/origin already used
// for its idle limb-float). One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const GENTLE_WAVE_BODY_DURATION_MS = 1700
const GENTLE_WAVE_PAW_DURATION_MS = 1400
// Sleepy Level 1 "Sleepy Stretch" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a slow body stretch, both front legs
// extending slightly (leg-front-left/leg-front-right, the same layers/
// origins already used for their idle limb-float), and a brief relaxed gill
// flutter, then settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SLEEPY_STRETCH_BODY_DURATION_MS = 2600
const SLEEPY_STRETCH_LEG_DURATION_MS = 2000
const SLEEPY_STRETCH_GILL_DURATION_MS = 800
// Foodie Level 1 "Hungry Wiggle" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a small side-to-side body wiggle, one
// tail swish, and a brief excited gill flutter, then settle. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const HUNGRY_WIGGLE_BODY_DURATION_MS = 1800
const HUNGRY_WIGGLE_TAIL_DURATION_MS = 900
const HUNGRY_WIGGLE_GILL_DURATION_MS = 700
// Playful Level 3 "Playtime Welcome" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a small forward lean, a gentle double
// bounce, and a brief gill wiggle, then settle facing forward. One-shot,
// plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const PLAYTIME_WELCOME_BODY_DURATION_MS = 2000
const PLAYTIME_WELCOME_GILL_DURATION_MS = 900
// Playful Level 5 "Encore!" personality-unlock celebration (see
// personalityUnlockAnimations.js) — one eager bounce, a brief held pause,
// then a smaller second bounce, with a quick gill wiggle and one small tail
// swish joining the rhythm before settling happy. Distinct from Level 1
// Happy Bounce's single celebratory hop and Level 3 Playtime Welcome's
// forward-leaning greeting feel. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const ENCORE_BODY_DURATION_MS = 2200
const ENCORE_GILL_DURATION_MS = 850
const ENCORE_GILL_DELAY_MS = 350
const ENCORE_TAIL_DURATION_MS = 900
const ENCORE_TAIL_DELAY_MS = 450
// Playful Level 8 "Show Off" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a small upward lift with a deliberate
// performative pause, both gills wiggling proudly and one tail flourish,
// then settle. Distinct from Encore's two-beat "one more time" rhythm by
// reading as a single confident little performance. One-shot, plays only
// inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const SHOW_OFF_BODY_DURATION_MS = 2400
const SHOW_OFF_GILL_DURATION_MS = 1100
const SHOW_OFF_TAIL_DURATION_MS = 1000
const SHOW_OFF_TAIL_DELAY_MS = 350
// Playful Level 12 "You're Here!" personality-unlock celebration — a happy
// little hop and approach, excited gill wiggle, a brief forward-facing pause,
// then a calm settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const YOURE_HERE_BODY_DURATION_MS = 2800
const YOURE_HERE_GILL_DURATION_MS = 850
const YOURE_HERE_GILL_DELAY_MS = 1100
// Curious Level 12 "Follow Me" personality-unlock celebration — notices the
// player, moves toward a point of interest, then tilts back toward the player
// and waits before settling. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const FOLLOW_ME_BODY_DURATION_MS = 3000
const FOLLOW_ME_HEAD_DURATION_MS = 2200
const FOLLOW_ME_GILL_DURATION_MS = 700
const FOLLOW_ME_GILL_DELAY_MS = 1250
// Gentle Level 12 "Happy Together" personality-unlock celebration — a
// restrained forward approach, soft closed-eye moment, subtle gill flutter,
// quiet linger, and calm settle. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const HAPPY_TOGETHER_BODY_DURATION_MS = 2800
const HAPPY_TOGETHER_GILL_DURATION_MS = 850
const HAPPY_TOGETHER_GILL_DELAY_MS = 850
const HAPPY_TOGETHER_EYES_DURATION_MS = 2100
// Sleepy Level 12 "Sleep Beside You" personality-unlock celebration — first
// approaches the player, then lowers into rest, briefly sleeps, wakes gently,
// and settles. One-shot, plays only inside PersonalityUnlockCelebration.jsx
// via the celebrationAnimation prop.
const SLEEP_BESIDE_YOU_BODY_DURATION_MS = 3300
const SLEEP_BESIDE_YOU_GILL_DURATION_MS = 1100
const SLEEP_BESIDE_YOU_GILL_DELAY_MS = 1500
const SLEEP_BESIDE_YOU_EYES_DURATION_MS = 3000
// Foodie Level 12 "Sharing Time" personality-unlock celebration — lifts toward
// the player, checks the feeding side, turns back for a hopeful shared pause,
// then settles. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SHARING_TIME_BODY_DURATION_MS = 2800
const SHARING_TIME_TAIL_DURATION_MS = 900
const SHARING_TIME_TAIL_DELAY_MS = 950
const SHARING_TIME_GILL_DURATION_MS = 750
const SHARING_TIME_GILL_DELAY_MS = 850
// Curious Level 8 "Explorer" personality-unlock celebration (see
// personalityUnlockAnimations.js) — glides slightly to one side, adds a
// head tilt, one brief gill twitch, and a small tail swish, then holds a
// short investigative pause before settling. Distinct from Who's There's
// forward curious reach and What Was That's shorter reactive lean by
// reading as a deliberate habitat inspection. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const EXPLORER_BODY_DURATION_MS = 2500
const EXPLORER_HEAD_DURATION_MS = 1400
const EXPLORER_GILL_DURATION_MS = 700
const EXPLORER_GILL_DELAY_MS = 650
const EXPLORER_TAIL_DURATION_MS = 900
const EXPLORER_TAIL_DELAY_MS = 700
// Curious Level 3 "Who's There?" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a small forward lean, a gentle head
// tilt, and a brief gill twitch, then settle facing forward. Same beats as
// Level 1 Curious Peek, but visually distinct: longer overall durations and
// each keyframe holds a plateau near its peak lean/tilt (identical values
// across a wider percentage span) instead of easing straight back, reading
// as a longer curious pause near the glass. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const WHOS_THERE_BODY_DURATION_MS = 2600
const WHOS_THERE_HEAD_DURATION_MS = 1500
const WHOS_THERE_GILL_DURATION_MS = 900
// Curious Level 5 "What Was That?" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a brief still pause, then
// leans slightly forward into one small head tilt with a short gill twitch,
// then settles facing forward. Distinct from Level 1 Curious Peek's quicker
// immediate investigate and Level 3 Who's There?'s longer held curious
// plateau. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const WHAT_WAS_THAT_BODY_DURATION_MS = 2300
const WHAT_WAS_THAT_HEAD_DURATION_MS = 1000
const WHAT_WAS_THAT_GILL_DURATION_MS = 650
const WHAT_WAS_THAT_GILL_DELAY_MS = 800
// Gentle Level 3 "Warm Hello" personality-unlock greeting (see
// personalityUnlockAnimations.js) — a gentle forward lean held as a clear
// acknowledgement beat, then one small front-paw wave (leg-front-right)
// starting only after that acknowledgement has read (via animation-delay),
// with a brief soft gill flutter alongside the wave, then settle facing
// forward. Distinct from Level 1 Happy Wave, which starts its paw wave
// immediately alongside the body lean with no separate acknowledgement
// beat. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const WARM_HELLO_BODY_DURATION_MS = 2000
const WARM_HELLO_PAW_DURATION_MS = 1200
const WARM_HELLO_PAW_DELAY_MS = 700
const WARM_HELLO_GILL_DURATION_MS = 700
const WARM_HELLO_GILL_DELAY_MS = 700
// Gentle Level 5 "Thank You" personality-unlock celebration (see
// personalityUnlockAnimations.js) — starts with a gentle forward lean, then
// one small front-paw wave with a soft gill flutter, then eases into a
// relaxed settle. Distinct from Level 1 Happy Wave's simpler wave and Level
// 3 Warm Hello's held hello beat by using an acknowledge, wave, relax
// rhythm. One-shot, plays only inside PersonalityUnlockCelebration.jsx via
// the celebrationAnimation prop.
const THANK_YOU_BODY_DURATION_MS = 2200
const THANK_YOU_PAW_DURATION_MS = 1200
const THANK_YOU_PAW_DELAY_MS = 650
const THANK_YOU_GILL_DURATION_MS = 700
const THANK_YOU_GILL_DELAY_MS = 700
// Gentle Level 8 "Peaceful Moment" personality-unlock celebration (see
// personalityUnlockAnimations.js) — briefly closes the eyes using the
// existing closed-eye art, softens the body into a gentle relaxed settle,
// adds a calm gill flutter, then reopens the eyes and settles. Calm and
// content rather than sleepy. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const PEACEFUL_MOMENT_BODY_DURATION_MS = 2500
const PEACEFUL_MOMENT_GILL_DURATION_MS = 900
const PEACEFUL_MOMENT_GILL_DELAY_MS = 700
const PEACEFUL_MOMENT_EYES_DURATION_MS = 2200
// Sleepy Level 3 "Drowsy Greeting" personality-unlock greeting (see
// personalityUnlockAnimations.js) — begins slightly lowered/tucked (the
// 0% keyframe itself is the drooped pose, not neutral), holds there
// briefly as if still asleep, slowly lifts the head/body to acknowledge
// the player, with a brief relaxed gill flutter as it wakes, then settle
// facing forward. Distinct from Level 1 Sleepy Stretch, which starts from
// the normal neutral pose and stretches outward/upward rather than waking
// up from a lowered rest pose. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const DROWSY_GREETING_BODY_DURATION_MS = 2800
const DROWSY_GREETING_GILL_DURATION_MS = 800
const DROWSY_GREETING_GILL_DELAY_MS = 1000
// Sleepy Level 5 "Cozy Time" personality-unlock celebration (see
// personalityUnlockAnimations.js) — a slow body stretch that eases into a
// content settled pose, with the front legs relaxing slightly and a brief
// soft gill flutter. Distinct from Level 1 Sleepy Stretch's more obvious
// physical stretch and Level 3 Drowsy Greeting's waking acknowledgement.
// One-shot, plays only inside PersonalityUnlockCelebration.jsx via the
// celebrationAnimation prop.
const COZY_TIME_BODY_DURATION_MS = 2600
const COZY_TIME_LEG_DURATION_MS = 1800
const COZY_TIME_GILL_DURATION_MS = 700
const COZY_TIME_GILL_DELAY_MS = 950
// Sleepy Level 8 "Power Nap" personality-unlock celebration (see
// personalityUnlockAnimations.js) — lowers into a brief closed-eye resting
// pose, gives one or two tiny gill flutters during the doze, then reopens
// the eyes with a small wake-up stretch and settles. Distinct from Cozy
// Time's content settle by clearly reading as a short nap. One-shot, plays
// only inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const POWER_NAP_BODY_DURATION_MS = 3000
const POWER_NAP_GILL_DURATION_MS = 1200
const POWER_NAP_GILL_DELAY_MS = 950
const POWER_NAP_EYES_DURATION_MS = 2850
// Foodie Level 3 "Snack Check" personality-unlock greeting (see
// personalityUnlockAnimations.js) — first lifts subtly toward the player
// in acknowledgement, then angles toward the feeding area for a clear
// "is there a snack?" beat, with one small tail swish and a brief gill
// flutter only after that second beat starts, then settle facing forward.
// Distinct from Level 1 Hungry Wiggle, which reads as immediate excitement
// rather than a deliberate two-step check. One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const SNACK_CHECK_BODY_DURATION_MS = 2400
const SNACK_CHECK_TAIL_DURATION_MS = 900
const SNACK_CHECK_TAIL_DELAY_MS = 1050
const SNACK_CHECK_GILL_DURATION_MS = 700
const SNACK_CHECK_GILL_DELAY_MS = 1150
// Foodie Level 5 "Still Hungry" personality-unlock celebration (see
// personalityUnlockAnimations.js) — begins with a small satisfied settle
// after eating, pauses briefly, then lifts hopefully toward the feeding
// area with one small tail swish and a brief gill flutter, then settles
// forward again. Distinct from Level 1 Hungry Wiggle's immediate excitement
// and Level 3 Snack Check's player-first greeting by reading as "that was
// nice... maybe one more?" One-shot, plays only inside
// PersonalityUnlockCelebration.jsx via the celebrationAnimation prop.
const STILL_HUNGRY_BODY_DURATION_MS = 2700
const STILL_HUNGRY_TAIL_DURATION_MS = 900
const STILL_HUNGRY_TAIL_DELAY_MS = 1450
const STILL_HUNGRY_GILL_DURATION_MS = 700
const STILL_HUNGRY_GILL_DELAY_MS = 1525
// Foodie Level 8 "Food Patrol" personality-unlock celebration (see
// personalityUnlockAnimations.js) — shifts slightly toward the feeding
// area, tilts the head upward into a short hopeful check, adds a brief gill
// flutter and one small tail swish, then settles when no food arrives.
// Distinct from Snack Check's player-first greeting and Still Hungry's
// post-meal hope by reading as a calm environmental scan. One-shot, plays
// only inside PersonalityUnlockCelebration.jsx via the celebrationAnimation
// prop.
const FOOD_PATROL_BODY_DURATION_MS = 2500
const FOOD_PATROL_TAIL_DURATION_MS = 850
const FOOD_PATROL_TAIL_DELAY_MS = 1200
const FOOD_PATROL_GILL_DURATION_MS = 750
const FOOD_PATROL_GILL_DELAY_MS = 1125

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
@keyframes axolotl-happy-bounce-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  22% { transform: translate(0, -4%) rotate(-2deg) scale(1.02); }
  46% { transform: translate(0, -1%) rotate(1deg) scale(1.01); }
  70% { transform: translate(0, -1.6%) rotate(-1deg) scale(1.008); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-happy-bounce-gill-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  30% { transform: translate(0, -0.5%) rotate(-6deg) scale(1.05); }
  60% { transform: translate(0, 0.2%) rotate(4deg) scale(1.02); }
}
@keyframes axolotl-happy-bounce-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(10deg); }
  70% { transform: rotate(-6deg); }
}
@keyframes axolotl-curious-peek-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  32% { transform: translate(-2%, -0.4%) rotate(-3deg) scale(1.012); }
  68% { transform: translate(-0.8%, -0.15%) rotate(-1.2deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-curious-peek-head-tilt {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  35% { transform: translate(-0.3%, -0.6%) rotate(-5deg); }
  70% { transform: translate(-0.1%, -0.2%) rotate(-1.8deg); }
}
@keyframes axolotl-curious-peek-gill-twitch {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(0, -0.2%) rotate(-3deg) scale(1.02); }
}
@keyframes axolotl-gentle-wave-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  32% { transform: translate(0, -0.5%) rotate(-1deg) scale(1.006); }
  70% { transform: translate(0, -0.15%) rotate(-0.3deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-gentle-wave-paw {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-14deg); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-6deg); }
}
@keyframes axolotl-sleepy-stretch-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  40% { transform: translate(0, -0.3%) rotate(0.5deg) scale(1.025); }
  75% { transform: translate(0, -0.1%) rotate(0.2deg) scale(1.008); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-sleepy-stretch-leg {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  45% { transform: translate(0.3%, 0.4%) rotate(6deg) scale(1.04); }
  80% { transform: translate(0.1%, 0.15%) rotate(2deg) scale(1.012); }
}
@keyframes axolotl-sleepy-stretch-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(0, -0.15%) rotate(-2deg) scale(1.015); }
}
@keyframes axolotl-hungry-wiggle-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  20% { transform: translate(-1.5%, 0) rotate(-3deg) scale(1.01); }
  40% { transform: translate(1.3%, 0) rotate(3deg) scale(1.008); }
  60% { transform: translate(-1%, 0) rotate(-2deg) scale(1.005); }
  80% { transform: translate(0.5%, 0) rotate(1deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-hungry-wiggle-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  40% { transform: rotate(12deg); }
  75% { transform: rotate(-7deg); }
}
@keyframes axolotl-hungry-wiggle-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  35% { transform: translate(0, -0.4%) rotate(-5deg) scale(1.04); }
  70% { transform: translate(0, 0.15%) rotate(3deg) scale(1.015); }
}
@keyframes axolotl-playtime-welcome-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  22% { transform: translate(-1.3%, -0.8%) rotate(-2deg) scale(1.015); }
  45% { transform: translate(-0.6%, -0.2%) rotate(-1deg) scale(1.006); }
  65% { transform: translate(-1%, -0.6%) rotate(-1.6deg) scale(1.01); }
  85% { transform: translate(-0.3%, -0.15%) rotate(-0.5deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-playtime-welcome-gill-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  40% { transform: translate(0, -0.3%) rotate(-4deg) scale(1.03); }
  75% { transform: translate(0, 0.1%) rotate(2deg) scale(1.012); }
}
@keyframes axolotl-encore-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  20% { transform: translate(0, -2.3%) rotate(-1.6deg) scale(1.014); }
  34% { transform: translate(0, -2.3%) rotate(-1.6deg) scale(1.014); }
  50% { transform: translate(0, -0.2%) rotate(-0.2deg) scale(1.002); }
  66% { transform: translate(0, -1.2%) rotate(-0.9deg) scale(1.008); }
  80% { transform: translate(0, -1.2%) rotate(-0.9deg) scale(1.008); }
  92% { transform: translate(0, -0.1%) rotate(-0.1deg) scale(1.001); }
}
@keyframes axolotl-encore-gill-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  35% { transform: translate(0, -0.28%) rotate(-4deg) scale(1.03); }
  72% { transform: translate(0, 0.12%) rotate(2deg) scale(1.012); }
}
@keyframes axolotl-encore-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  38% { transform: rotate(11deg); }
  72% { transform: rotate(-6deg); }
}
@keyframes axolotl-show-off-body {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(0, -1.9%) rotate(-1.2deg) scale(1.012); }
  40% { transform: translate(0, -1.9%) rotate(-1.2deg) scale(1.012); }
  64% { transform: translate(0, -0.7%) rotate(-0.5deg) scale(1.005); }
  78% { transform: translate(0, -0.7%) rotate(-0.5deg) scale(1.005); }
  92% { transform: translate(0, -0.08%) rotate(-0.08deg) scale(1.001); }
}
@keyframes axolotl-show-off-gill-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  30% { transform: translate(0, -0.32%) rotate(-4.5deg) scale(1.035); }
  52% { transform: translate(0, 0.14%) rotate(2.8deg) scale(1.016); }
  72% { transform: translate(0, -0.18%) rotate(-2deg) scale(1.01); }
}
@keyframes axolotl-show-off-tail-flourish {
  0%, 100% { transform: rotate(0deg); }
  34% { transform: rotate(13deg); }
  58% { transform: rotate(-8deg); }
  78% { transform: rotate(4deg); }
}
@keyframes axolotl-youre-here-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  16% { transform: translate(0, -2.2%) rotate(-1deg) scale(1.015); }
  42% { transform: translate(-1.2%, -0.5%) rotate(-1.2deg) scale(1.02); }
  68% { transform: translate(-1.2%, -0.5%) rotate(-1.2deg) scale(1.02); }
  86% { transform: translate(-0.25%, -0.08%) rotate(-0.2deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-youre-here-gill-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  32% { transform: translate(0, -0.28%) rotate(-3.5deg) scale(1.028); }
  62% { transform: translate(0, 0.08%) rotate(2deg) scale(1.014); }
}
@keyframes axolotl-follow-me-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  15% { transform: translate(0, -0.8%) rotate(-1deg) scale(1.006); }
  38% { transform: translate(-1.7%, -0.15%) rotate(-2deg) scale(1.012); }
  58% { transform: translate(-1.7%, -0.15%) rotate(-2deg) scale(1.012); }
  72% { transform: translate(0.35%, -0.05%) rotate(1.6deg) scale(1.006); }
  86% { transform: translate(0.35%, -0.05%) rotate(1.6deg) scale(1.006); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-follow-me-head-tilt {
  0% { transform: translate(0, 0) rotate(0deg); }
  18% { transform: translate(0, -0.8%) rotate(-3deg); }
  42% { transform: translate(-1.35%, -0.18%) rotate(-4deg); }
  60% { transform: translate(-1.35%, -0.18%) rotate(-4deg); }
  76% { transform: translate(0.45%, -0.12%) rotate(3deg); }
  88% { transform: translate(0.45%, -0.12%) rotate(3deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes axolotl-follow-me-gill-wiggle {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(0, -0.2%) rotate(-2.8deg) scale(1.022); }
  70% { transform: translate(0, 0.08%) rotate(1.5deg) scale(1.01); }
}
@keyframes axolotl-happy-together-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(-0.9%, -0.35%) rotate(-0.8deg) scale(1.008); }
  46% { transform: translate(-0.9%, -0.35%) rotate(-0.8deg) scale(1.008); }
  58% { transform: translate(-0.9%, -0.05%) rotate(0.5deg) scale(1.002); }
  72% { transform: translate(-0.9%, -0.35%) rotate(-0.8deg) scale(1.008); }
  88% { transform: translate(-0.2%, -0.08%) rotate(-0.15deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-happy-together-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(0, -0.16%) rotate(-2.2deg) scale(1.018); }
  70% { transform: translate(0, 0.06%) rotate(1deg) scale(1.008); }
}
@keyframes axolotl-happy-together-eyes {
  0%, 22%, 76%, 100% { opacity: 0; }
  34%, 64% { opacity: 1; }
}
@keyframes axolotl-sleep-beside-you-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  22% { transform: translate(-0.8%, -0.35%) rotate(-0.8deg) scale(1.006); }
  42% { transform: translate(-1.1%, -0.2%) rotate(-0.7deg) scale(1.008); }
  58% { transform: translate(-1.1%, 0.9%) rotate(1.2deg) scale(0.998); }
  76% { transform: translate(-1.1%, 0.9%) rotate(1.2deg) scale(0.998); }
  90% { transform: translate(-0.2%, -0.12%) rotate(-0.2deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-sleep-beside-you-gill-flutter {
  0%, 18%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  38% { transform: translate(0, -0.12%) rotate(-1.6deg) scale(1.012); }
  58% { transform: translate(0, 0.04%) rotate(0.7deg) scale(1.006); }
  74% { transform: translate(0, -0.1%) rotate(-1.3deg) scale(1.01); }
}
@keyframes axolotl-sleep-beside-you-eyes {
  0%, 28%, 80%, 100% { opacity: 0; }
  40%, 70% { opacity: 1; }
}
@keyframes axolotl-sharing-time-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  18% { transform: translate(0, -0.5%) rotate(-1deg) scale(1.006); }
  40% { transform: translate(1.15%, -0.15%) rotate(2.2deg) scale(1.01); }
  58% { transform: translate(1.15%, -0.15%) rotate(2.2deg) scale(1.01); }
  72% { transform: translate(-0.25%, -0.08%) rotate(-1.3deg) scale(1.004); }
  86% { transform: translate(-0.25%, -0.08%) rotate(-1.3deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-sharing-time-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  48% { transform: rotate(7deg); }
  70% { transform: rotate(-3deg); }
}
@keyframes axolotl-sharing-time-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  54% { transform: translate(0, -0.16%) rotate(-2deg) scale(1.016); }
  76% { transform: translate(0, 0.05%) rotate(1deg) scale(1.008); }
}
@keyframes axolotl-explorer-body {
  0%, 14% { transform: translate(0, 0) rotate(0deg) scale(1); }
  36% { transform: translate(-1.8%, -0.22%) rotate(-2.2deg) scale(1.01); }
  56% { transform: translate(-1.8%, -0.22%) rotate(-2.2deg) scale(1.01); }
  76% { transform: translate(-0.55%, -0.06%) rotate(-0.7deg) scale(1.003); }
  90% { transform: translate(-0.55%, -0.06%) rotate(-0.7deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-explorer-head-tilt {
  0%, 14% { transform: translate(0, 0) rotate(0deg); }
  44% { transform: translate(-0.28%, -0.42%) rotate(-4deg); }
  66% { transform: translate(-0.08%, -0.22%) rotate(1.8deg); }
  84% { transform: translate(-0.04%, -0.1%) rotate(-0.6deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes axolotl-explorer-gill-twitch {
  0%, 24%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  52% { transform: translate(0, -0.22%) rotate(-3.2deg) scale(1.024); }
  72% { transform: translate(0, -0.08%) rotate(-1deg) scale(1.01); }
}
@keyframes axolotl-explorer-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  36% { transform: rotate(10deg); }
  62% { transform: rotate(-6deg); }
  82% { transform: rotate(3deg); }
}
@keyframes axolotl-curious-greeting-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  30% { transform: translate(-2%, -0.4%) rotate(-3deg) scale(1.012); }
  55% { transform: translate(-2%, -0.4%) rotate(-3deg) scale(1.012); }
  80% { transform: translate(-0.8%, -0.15%) rotate(-1.2deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-curious-greeting-head-tilt {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  30% { transform: translate(-0.3%, -0.6%) rotate(-5deg); }
  60% { transform: translate(-0.3%, -0.6%) rotate(-5deg); }
  85% { transform: translate(-0.1%, -0.2%) rotate(-1.8deg); }
}
@keyframes axolotl-curious-greeting-gill-twitch {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  45% { transform: translate(0, -0.2%) rotate(-3deg) scale(1.02); }
  60% { transform: translate(0, -0.2%) rotate(-3deg) scale(1.02); }
}
@keyframes axolotl-what-was-that-body {
  0%, 16% { transform: translate(0, 0) rotate(0deg) scale(1); }
  46% { transform: translate(-1.4%, -0.25%) rotate(-2deg) scale(1.01); }
  68% { transform: translate(-0.8%, -0.15%) rotate(-1deg) scale(1.004); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-what-was-that-head-tilt {
  0%, 18% { transform: translate(0, 0) rotate(0deg); }
  55% { transform: translate(-0.28%, -0.45%) rotate(-4deg); }
  76% { transform: translate(0.18%, -0.18%) rotate(2deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes axolotl-what-was-that-gill-twitch {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(0, -0.18%) rotate(-3deg) scale(1.02); }
  68% { transform: translate(0, 0.08%) rotate(1.5deg) scale(1.008); }
}
@keyframes axolotl-warm-hello-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(-1.4%, -0.3%) rotate(-2.5deg) scale(1.012); }
  45% { transform: translate(-1.4%, -0.3%) rotate(-2.5deg) scale(1.012); }
  70% { transform: translate(-0.3%, -0.05%) rotate(-0.5deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-warm-hello-paw {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-14deg); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-6deg); }
}
@keyframes axolotl-warm-hello-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(0, -0.15%) rotate(-2deg) scale(1.015); }
}
@keyframes axolotl-thank-you-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(-1.2%, -0.28%) rotate(-2deg) scale(1.01); }
  42% { transform: translate(-1.2%, -0.28%) rotate(-2deg) scale(1.01); }
  72% { transform: translate(-0.35%, -0.08%) rotate(-0.5deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-thank-you-paw {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-12deg); }
  50% { transform: rotate(7deg); }
  75% { transform: rotate(-5deg); }
}
@keyframes axolotl-thank-you-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(0, -0.15%) rotate(-2deg) scale(1.015); }
}
@keyframes axolotl-peaceful-moment-body {
  0%, 16% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(0, 0.18%) rotate(0.5deg) scale(0.997); }
  60% { transform: translate(0, 0.18%) rotate(0.5deg) scale(0.997); }
  82% { transform: translate(0, 0.04%) rotate(0.12deg) scale(0.999); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-peaceful-moment-gill-flutter {
  0%, 24%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  48% { transform: translate(0, -0.16%) rotate(-2.2deg) scale(1.018); }
  70% { transform: translate(0, 0.06%) rotate(1deg) scale(1.008); }
}
@keyframes axolotl-peaceful-moment-eyes {
  0%, 24%, 78%, 100% { opacity: 0; }
  36%, 64% { opacity: 1; }
}
@keyframes axolotl-drowsy-greeting-body {
  0% { transform: translate(0, 1.2%) rotate(2deg) scale(0.995); }
  15% { transform: translate(0, 1.2%) rotate(2deg) scale(0.995); }
  55% { transform: translate(0, -0.5%) rotate(-1deg) scale(1.01); }
  80% { transform: translate(0, -0.15%) rotate(-0.3deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-drowsy-greeting-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(0, -0.15%) rotate(-2deg) scale(1.015); }
}
@keyframes axolotl-cozy-time-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  34% { transform: translate(0, -0.22%) rotate(0.45deg) scale(1.02); }
  68% { transform: translate(0, 0.35%) rotate(1.1deg) scale(0.998); }
  100% { transform: translate(0, 0.32%) rotate(0.9deg) scale(0.998); }
}
@keyframes axolotl-cozy-time-leg {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  45% { transform: translate(0.18%, 0.22%) rotate(4deg) scale(1.025); }
  82% { transform: translate(0.08%, 0.16%) rotate(2deg) scale(1.01); }
}
@keyframes axolotl-cozy-time-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(0, -0.12%) rotate(-1.8deg) scale(1.012); }
}
@keyframes axolotl-power-nap-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  28% { transform: translate(0, 1.15%) rotate(1.8deg) scale(0.995); }
  58% { transform: translate(0, 1.15%) rotate(1.8deg) scale(0.995); }
  80% { transform: translate(0.12%, -0.18%) rotate(-0.4deg) scale(1.008); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-power-nap-gill-flutter {
  0%, 18%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  32% { transform: translate(0, -0.12%) rotate(-1.6deg) scale(1.01); }
  48% { transform: translate(0, 0.05%) rotate(0.6deg) scale(1.004); }
  66% { transform: translate(0, -0.16%) rotate(-2deg) scale(1.012); }
  82% { transform: translate(0, 0.06%) rotate(0.8deg) scale(1.004); }
}
@keyframes axolotl-power-nap-eyes {
  0%, 16%, 82%, 100% { opacity: 0; }
  26%, 70% { opacity: 1; }
}
@keyframes axolotl-snack-check-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  22% { transform: translate(-1.3%, -0.8%) rotate(-2deg) scale(1.012); }
  38% { transform: translate(-1.3%, -0.8%) rotate(-2deg) scale(1.012); }
  62% { transform: translate(0.8%, -0.25%) rotate(2.6deg) scale(1.008); }
  78% { transform: translate(0.8%, -0.25%) rotate(2.6deg) scale(1.008); }
  92% { transform: translate(0.2%, -0.08%) rotate(0.6deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-snack-check-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  42% { transform: rotate(10deg); }
  75% { transform: rotate(-5deg); }
}
@keyframes axolotl-snack-check-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  40% { transform: translate(0, -0.3%) rotate(-4deg) scale(1.03); }
  72% { transform: translate(0, 0.1%) rotate(2deg) scale(1.012); }
}
@keyframes axolotl-still-hungry-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  18% { transform: translate(0, 0.25%) rotate(0.6deg) scale(0.996); }
  32% { transform: translate(0, 0.25%) rotate(0.6deg) scale(0.996); }
  50% { transform: translate(0, 0.25%) rotate(0.6deg) scale(0.996); }
  72% { transform: translate(1.2%, -0.42%) rotate(2.4deg) scale(1.01); }
  84% { transform: translate(1.2%, -0.42%) rotate(2.4deg) scale(1.01); }
  94% { transform: translate(0.28%, -0.08%) rotate(0.7deg) scale(1.003); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-still-hungry-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  38% { transform: rotate(8deg); }
  72% { transform: rotate(-4deg); }
}
@keyframes axolotl-still-hungry-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(0, -0.22%) rotate(-3deg) scale(1.022); }
  74% { transform: translate(0, 0.08%) rotate(1.2deg) scale(1.008); }
}
@keyframes axolotl-food-patrol-body {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(1.15%, -0.15%) rotate(1.8deg) scale(1.008); }
  48% { transform: translate(1.15%, -0.15%) rotate(1.8deg) scale(1.008); }
  66% { transform: translate(1.2%, -0.55%) rotate(2.6deg) scale(1.01); }
  80% { transform: translate(1.2%, -0.55%) rotate(2.6deg) scale(1.01); }
  92% { transform: translate(0.25%, -0.08%) rotate(0.6deg) scale(1.002); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes axolotl-food-patrol-tail-swish {
  0%, 100% { transform: rotate(0deg); }
  38% { transform: rotate(8deg); }
  72% { transform: rotate(-4deg); }
}
@keyframes axolotl-food-patrol-gill-flutter {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  42% { transform: translate(0, -0.22%) rotate(-3deg) scale(1.022); }
  74% { transform: translate(0, 0.08%) rotate(1.2deg) scale(1.008); }
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
  expression = PET_EXPRESSIONS.neutral,
  isEating = false,
  isFeeding = false,
  feedTrigger = 0,
  isPlaying = false,
  isCleaning = false,
  onPetPersist,
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
  const face = getAxolotlFaceState(mood, stats, expression, isEating)
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
        const fallbackAnimation = Math.random() < 0.5 ? 'head-lift' : 'gill-flutter'
        const nextAnimation = selectIdleAnimation({
          species: 'axolotl',
          earnedPersonalityUnlockKeys,
          fallbackAnimation,
          suppressFoodPatrol: suppressFoodPatrolRef.current,
        })
        suppressFoodPatrolRef.current = false
        const durationMs = nextAnimation === 'head-lift'
          ? IDLE_HEAD_LIFT_DURATION_MS
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
  const usesClosedEyesOverlay = (specialAnimation === 'peaceful-moment' || specialAnimation === 'power-nap' || specialAnimation === 'happy-together' || specialAnimation === 'sleep-beside-you') && !isPetting
  const layers = usesClosedEyesOverlay
    ? [...BASE_LAYERS, eyes, 'eyes-closed', pettingMouth]
    : [...BASE_LAYERS, pettingEyes, pettingMouth]

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

  function getCelebrationWrapperStyle(layer) {
    if (level1Animation === 'happy-bounce') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-happy-bounce-gill-wiggle ${HAPPY_BOUNCE_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-happy-bounce-tail-swish ${HAPPY_BOUNCE_TAIL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'curious-peek') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '37% 48%',
          animation: `axolotl-curious-peek-head-tilt ${CURIOUS_PEEK_HEAD_DURATION_MS}ms ease-out 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-curious-peek-gill-twitch ${CURIOUS_PEEK_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'gentle-wave') {
      if (layer === 'leg-front-right') {
        return {
          transformOrigin: '46% 62%',
          animation: `axolotl-gentle-wave-paw ${GENTLE_WAVE_PAW_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'sleepy-stretch') {
      if (layer === 'leg-front-left' || layer === 'leg-front-right') {
        return {
          transformOrigin: layer === 'leg-front-left' ? '26% 61%' : '46% 62%',
          animation: `axolotl-sleepy-stretch-leg ${SLEEPY_STRETCH_LEG_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-sleepy-stretch-gill-flutter ${SLEEPY_STRETCH_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (level1Animation === 'hungry-wiggle') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-hungry-wiggle-gill-flutter ${HUNGRY_WIGGLE_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-hungry-wiggle-tail-swish ${HUNGRY_WIGGLE_TAIL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'playtime-welcome') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-playtime-welcome-gill-wiggle ${PLAYTIME_WELCOME_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'encore') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-encore-gill-wiggle ${ENCORE_GILL_DURATION_MS}ms ease-in-out ${ENCORE_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-encore-tail-swish ${ENCORE_TAIL_DURATION_MS}ms ease-in-out ${ENCORE_TAIL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'show-off') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-show-off-gill-wiggle ${SHOW_OFF_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-show-off-tail-flourish ${SHOW_OFF_TAIL_DURATION_MS}ms ease-in-out ${SHOW_OFF_TAIL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'youre-here') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-youre-here-gill-wiggle ${YOURE_HERE_GILL_DURATION_MS}ms ease-in-out ${YOURE_HERE_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'follow-me') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '37% 48%',
          animation: `axolotl-follow-me-head-tilt ${FOLLOW_ME_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-follow-me-gill-wiggle ${FOLLOW_ME_GILL_DURATION_MS}ms ease-in-out ${FOLLOW_ME_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'happy-together') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-happy-together-gill-flutter ${HAPPY_TOGETHER_GILL_DURATION_MS}ms ease-in-out ${HAPPY_TOGETHER_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `axolotl-happy-together-eyes ${HAPPY_TOGETHER_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'sleep-beside-you') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-sleep-beside-you-gill-flutter ${SLEEP_BESIDE_YOU_GILL_DURATION_MS}ms ease-in-out ${SLEEP_BESIDE_YOU_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `axolotl-sleep-beside-you-eyes ${SLEEP_BESIDE_YOU_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'sharing-time') {
      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-sharing-time-tail-swish ${SHARING_TIME_TAIL_DURATION_MS}ms ease-in-out ${SHARING_TIME_TAIL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-sharing-time-gill-flutter ${SHARING_TIME_GILL_DURATION_MS}ms ease-in-out ${SHARING_TIME_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'explorer') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '37% 48%',
          animation: `axolotl-explorer-head-tilt ${EXPLORER_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-explorer-gill-twitch ${EXPLORER_GILL_DURATION_MS}ms ease-in-out ${EXPLORER_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-explorer-tail-swish ${EXPLORER_TAIL_DURATION_MS}ms ease-in-out ${EXPLORER_TAIL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'curious-greeting') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '37% 48%',
          animation: `axolotl-curious-greeting-head-tilt ${WHOS_THERE_HEAD_DURATION_MS}ms ease-out 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-curious-greeting-gill-twitch ${WHOS_THERE_GILL_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'what-was-that') {
      if (layer === 'head' || layer === eyes || layer === mouth) {
        return {
          transformOrigin: '37% 48%',
          animation: `axolotl-what-was-that-head-tilt ${WHAT_WAS_THAT_HEAD_DURATION_MS}ms ease-in-out 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-what-was-that-gill-twitch ${WHAT_WAS_THAT_GILL_DURATION_MS}ms ease-in-out ${WHAT_WAS_THAT_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'warm-hello') {
      if (layer === 'leg-front-right') {
        return {
          transformOrigin: '46% 62%',
          animation: `axolotl-warm-hello-paw ${WARM_HELLO_PAW_DURATION_MS}ms ease-in-out ${WARM_HELLO_PAW_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-warm-hello-gill-flutter ${WARM_HELLO_GILL_DURATION_MS}ms ease-in-out ${WARM_HELLO_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'thank-you') {
      if (layer === 'leg-front-right') {
        return {
          transformOrigin: '46% 62%',
          animation: `axolotl-thank-you-paw ${THANK_YOU_PAW_DURATION_MS}ms ease-in-out ${THANK_YOU_PAW_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-thank-you-gill-flutter ${THANK_YOU_GILL_DURATION_MS}ms ease-in-out ${THANK_YOU_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'peaceful-moment') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-peaceful-moment-gill-flutter ${PEACEFUL_MOMENT_GILL_DURATION_MS}ms ease-in-out ${PEACEFUL_MOMENT_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `axolotl-peaceful-moment-eyes ${PEACEFUL_MOMENT_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'drowsy-greeting') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-drowsy-greeting-gill-flutter ${DROWSY_GREETING_GILL_DURATION_MS}ms ease-in-out ${DROWSY_GREETING_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'cozy-time') {
      if (layer === 'leg-front-left' || layer === 'leg-front-right') {
        return {
          transformOrigin: layer === 'leg-front-left' ? '26% 61%' : '46% 62%',
          animation: `axolotl-cozy-time-leg ${COZY_TIME_LEG_DURATION_MS}ms ease-in-out 1 forwards`,
        }
      }

      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-cozy-time-gill-flutter ${COZY_TIME_GILL_DURATION_MS}ms ease-in-out ${COZY_TIME_GILL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'power-nap') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-power-nap-gill-flutter ${POWER_NAP_GILL_DURATION_MS}ms ease-in-out ${POWER_NAP_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'eyes-closed') {
        return {
          animation: `axolotl-power-nap-eyes ${POWER_NAP_EYES_DURATION_MS}ms ease-in-out 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'snack-check') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-snack-check-gill-flutter ${SNACK_CHECK_GILL_DURATION_MS}ms ease-in-out ${SNACK_CHECK_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-snack-check-tail-swish ${SNACK_CHECK_TAIL_DURATION_MS}ms ease-in-out ${SNACK_CHECK_TAIL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'still-hungry') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-still-hungry-gill-flutter ${STILL_HUNGRY_GILL_DURATION_MS}ms ease-in-out ${STILL_HUNGRY_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-still-hungry-tail-swish ${STILL_HUNGRY_TAIL_DURATION_MS}ms ease-in-out ${STILL_HUNGRY_TAIL_DELAY_MS}ms 1`,
        }
      }

      return {}
    }

    if (specialAnimation === 'food-patrol') {
      if (layer === 'gills-left' || layer === 'gills-right') {
        return {
          transformOrigin: layer === 'gills-left' ? '25% 37%' : '42% 64%',
          animation: `axolotl-food-patrol-gill-flutter ${FOOD_PATROL_GILL_DURATION_MS}ms ease-in-out ${FOOD_PATROL_GILL_DELAY_MS}ms 1`,
        }
      }

      if (layer === 'tail') {
        return {
          transformOrigin: '61% 54%',
          animation: `axolotl-food-patrol-tail-swish ${FOOD_PATROL_TAIL_DURATION_MS}ms ease-in-out ${FOOD_PATROL_TAIL_DELAY_MS}ms 1`,
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
  const actionStyle = level1Animation === 'happy-bounce'
    ? { animation: `axolotl-happy-bounce-body ${HAPPY_BOUNCE_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'curious-peek'
    ? { animation: `axolotl-curious-peek-body ${CURIOUS_PEEK_BODY_DURATION_MS}ms ease-out 1` }
    : level1Animation === 'gentle-wave'
    ? { animation: `axolotl-gentle-wave-body ${GENTLE_WAVE_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'sleepy-stretch'
    ? { animation: `axolotl-sleepy-stretch-body ${SLEEPY_STRETCH_BODY_DURATION_MS}ms ease-in-out 1` }
    : level1Animation === 'hungry-wiggle'
    ? { animation: `axolotl-hungry-wiggle-body ${HUNGRY_WIGGLE_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'playtime-welcome'
    ? { animation: `axolotl-playtime-welcome-body ${PLAYTIME_WELCOME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'encore'
    ? { animation: `axolotl-encore-body ${ENCORE_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'show-off'
    ? { animation: `axolotl-show-off-body ${SHOW_OFF_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'youre-here'
    ? { animation: `axolotl-youre-here-body ${YOURE_HERE_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'follow-me'
    ? { animation: `axolotl-follow-me-body ${FOLLOW_ME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'happy-together'
    ? { animation: `axolotl-happy-together-body ${HAPPY_TOGETHER_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'sleep-beside-you'
    ? { animation: `axolotl-sleep-beside-you-body ${SLEEP_BESIDE_YOU_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'sharing-time'
    ? { animation: `axolotl-sharing-time-body ${SHARING_TIME_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'explorer'
    ? { animation: `axolotl-explorer-body ${EXPLORER_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'curious-greeting'
    ? { animation: `axolotl-curious-greeting-body ${WHOS_THERE_BODY_DURATION_MS}ms ease-out 1` }
    : specialAnimation === 'what-was-that'
    ? { animation: `axolotl-what-was-that-body ${WHAT_WAS_THAT_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'warm-hello'
    ? { animation: `axolotl-warm-hello-body ${WARM_HELLO_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'thank-you'
    ? { animation: `axolotl-thank-you-body ${THANK_YOU_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'peaceful-moment'
    ? { animation: `axolotl-peaceful-moment-body ${PEACEFUL_MOMENT_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'drowsy-greeting'
    ? { animation: `axolotl-drowsy-greeting-body ${DROWSY_GREETING_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'cozy-time'
    ? { animation: `axolotl-cozy-time-body ${COZY_TIME_BODY_DURATION_MS}ms ease-in-out 1 forwards` }
    : specialAnimation === 'power-nap'
    ? { animation: `axolotl-power-nap-body ${POWER_NAP_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'snack-check'
    ? { animation: `axolotl-snack-check-body ${SNACK_CHECK_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'still-hungry'
    ? { animation: `axolotl-still-hungry-body ${STILL_HUNGRY_BODY_DURATION_MS}ms ease-in-out 1` }
    : specialAnimation === 'food-patrol'
    ? { animation: `axolotl-food-patrol-body ${FOOD_PATROL_BODY_DURATION_MS}ms ease-in-out 1` }
    : isFeeding
    ? { animation: 'axolotl-feed-anticipation 700ms ease-out 1 forwards' }
    : celebrationGreeting
      ? { animation: 'axolotl-play-wiggle 900ms ease-in-out 1' }
      : isPlaying
      ? { animation: 'axolotl-play-wiggle 1.4s ease-in-out 1' }
      : isReleasingFeed
        ? { animation: `axolotl-feed-release ${FEED_RELEASE_DURATION_MS}ms ease-out 1 forwards` }
        : isPetting
          ? { animation: `axolotl-petting-lean ${PETTING_REACTION_DURATION_MS}ms ease-out 1 forwards` }
        : { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 500ms ease-out' }

  return (
    <div
      className={`absolute left-1/2 top-[54%] ${sizeClass} -translate-x-1/2 -translate-y-1/2 ${bob}`}
      role="img"
      aria-label={`Mochi the axolotl, mood: ${mood}`}
      style={bob ? { animationDelay: `${idleLoopDelays.bob}s` } : undefined}
    >
      <style>{AXOLOTL_KEYFRAMES}</style>
      <div
        className="relative aspect-[503/410] w-full drop-shadow-lg"
        style={actionStyle}
        onAnimationEnd={(event) => {
          if (attachmentAnimation && event.currentTarget === event.target) onAttachmentAnimationComplete?.()
        }}
      >
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
              style={{
                zIndex: index,
                ...getPettingWrapperStyle(layer),
                ...getIdleWrapperStyle(layer),
                ...getCelebrationWrapperStyle(layer),
              }}
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
