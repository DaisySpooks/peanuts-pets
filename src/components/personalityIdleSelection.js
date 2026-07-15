import { getUnlockCelebrationAnimation } from './personalityUnlockAnimations.js'

const LEVEL_1_IDLE_UNLOCK_KEYS = [
  'playful_happy_bounce',
  'curious_curious_peek',
  'gentle_happy_wave',
  'sleepy_sleepy_stretch',
  'foodie_hungry_wiggle',
]

const LEVEL_8_IDLE_UNLOCK_KEYS = [
  'playful_show_off',
  'curious_explorer',
  'gentle_peaceful_moment',
  'sleepy_power_nap',
  'foodie_food_patrol',
]

const LEVEL_1_IDLE_ANIMATIONS = new Set([
  'happy-bounce',
  'curious-peek',
  'gentle-wave',
  'sleepy-stretch',
  'hungry-wiggle',
])

const LEVEL_8_IDLE_ANIMATIONS = new Set([
  'show-off',
  'explorer',
  'peaceful-moment',
  'power-nap',
  'food-patrol',
])

export const PERSONALITY_IDLE_OPPORTUNITY_CHANCE = 0.12
export const LEVEL_8_HABIT_OPPORTUNITY_CHANCE = 0.04

export function isLevel1PersonalityIdleAnimation(animation) {
  return LEVEL_1_IDLE_ANIMATIONS.has(animation)
}

export function isLevel8PersonalityIdleAnimation(animation) {
  return LEVEL_8_IDLE_ANIMATIONS.has(animation)
}

function getEarnedLevel1IdleAnimation(species, earnedPersonalityUnlockKeys) {
  if (!Array.isArray(earnedPersonalityUnlockKeys)) return null

  for (const unlockKey of LEVEL_1_IDLE_UNLOCK_KEYS) {
    if (!earnedPersonalityUnlockKeys.includes(unlockKey)) continue
    const animation = getUnlockCelebrationAnimation(unlockKey, species)
    if (animation) return animation
  }

  return null
}

function getEarnedLevel8HabitAnimation(species, earnedPersonalityUnlockKeys, { suppressFoodPatrol = false } = {}) {
  if (!Array.isArray(earnedPersonalityUnlockKeys)) return null

  for (const unlockKey of LEVEL_8_IDLE_UNLOCK_KEYS) {
    if (suppressFoodPatrol && unlockKey === 'foodie_food_patrol') continue
    if (!earnedPersonalityUnlockKeys.includes(unlockKey)) continue
    const animation = getUnlockCelebrationAnimation(unlockKey, species)
    if (animation) return animation
  }

  return null
}

// Uses the existing unlock-key -> animation lookup to make a Level 1
// personality idle animation occasionally eligible during the normal idle
// scheduler, while Level 8 autonomous habits get a rarer first pass through
// the same scheduler. If neither personality branch wins, the caller's
// standard idle choice still runs unchanged.
export function selectIdleAnimation({
  species,
  earnedPersonalityUnlockKeys,
  fallbackAnimation,
  opportunityRoll = Math.random(),
  level8OpportunityRoll = Math.random(),
  suppressFoodPatrol = false,
}) {
  const level8Animation = getEarnedLevel8HabitAnimation(species, earnedPersonalityUnlockKeys, { suppressFoodPatrol })
  if (level8Animation && level8OpportunityRoll < LEVEL_8_HABIT_OPPORTUNITY_CHANCE) return level8Animation

  const personalityAnimation = getEarnedLevel1IdleAnimation(species, earnedPersonalityUnlockKeys)
  if (!personalityAnimation) return fallbackAnimation
  if (opportunityRoll >= PERSONALITY_IDLE_OPPORTUNITY_CHANCE) return fallbackAnimation
  return personalityAnimation
}
