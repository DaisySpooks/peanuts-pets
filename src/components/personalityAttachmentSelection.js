import { getUnlockCelebrationAnimation } from './personalityUnlockAnimations.js'
import { selectReturnGreetingAnimation } from './personalityGreetingSelection.js'

const LEVEL_12_ATTACHMENT_UNLOCK_KEYS = {
  playful: 'playful_youre_here',
  curious: 'curious_follow_me',
  gentle: 'gentle_happy_together',
  sleepy: 'sleepy_sleep_beside_you',
  foodie: 'foodie_sharing_time',
}

export const LEVEL_12_ATTACHMENT_OPPORTUNITY_CHANCE = 0.25

// Selects a rare Level 12 attachment only at the completion boundary of the
// matching Level 3 return greeting. The caller owns the one-transition-per-
// greeting-flow guard; this helper remains pure for deterministic tests.
export function selectReturnAttachmentAnimation({
  species,
  temperament,
  earnedPersonalityUnlockKeys,
  greetingAnimation,
  random = Math.random,
}) {
  if (!Array.isArray(earnedPersonalityUnlockKeys)) return null

  const level3Animation = selectReturnGreetingAnimation({
    species,
    temperament,
    earnedPersonalityUnlockKeys,
  })
  if (!level3Animation || greetingAnimation !== level3Animation) return null

  const unlockKey = LEVEL_12_ATTACHMENT_UNLOCK_KEYS[temperament]
  if (!unlockKey || !earnedPersonalityUnlockKeys.includes(unlockKey)) return null
  if (typeof random !== 'function' || random() >= LEVEL_12_ATTACHMENT_OPPORTUNITY_CHANCE) return null

  return getUnlockCelebrationAnimation(unlockKey, species)
}
