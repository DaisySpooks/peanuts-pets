import { getUnlockCelebrationAnimation } from './personalityUnlockAnimations.js'

const LEVEL_3_GREETING_UNLOCK_KEYS = {
  playful: 'playful_playtime_welcome',
  curious: 'curious_whos_there',
  gentle: 'gentle_warm_hello',
  sleepy: 'sleepy_drowsy_greeting',
  foodie: 'foodie_snack_check',
}

// Picks the runtime return-greeting animation token for a pet that has
// earned its temperament's Level 3 greeting unlock. Returns null when the
// temperament is unknown, the unlock has not been earned, or the species
// has no matching animation so the caller can keep the existing generic
// greeting behavior unchanged.
export function selectReturnGreetingAnimation({ species, temperament, earnedPersonalityUnlockKeys }) {
  if (!Array.isArray(earnedPersonalityUnlockKeys)) return null

  const unlockKey = LEVEL_3_GREETING_UNLOCK_KEYS[temperament]
  if (!unlockKey || !earnedPersonalityUnlockKeys.includes(unlockKey)) return null

  return getUnlockCelebrationAnimation(unlockKey, species)
}
