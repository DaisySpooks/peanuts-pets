import { getUnlockCelebrationAnimation } from './personalityUnlockAnimations.js'

const LEVEL_5_ACTION_REACTIONS = {
  playful: {
    unlockKey: 'playful_encore',
    eligibleActions: new Set(['play']),
  },
  curious: {
    unlockKey: 'curious_what_was_that',
    eligibleActions: new Set(['clean', 'play']),
  },
  gentle: {
    unlockKey: 'gentle_thank_you',
    eligibleActions: new Set(['feed', 'clean', 'play', 'pet', 'treat']),
  },
  sleepy: {
    unlockKey: 'sleepy_cozy_time',
    eligibleActions: new Set(['feed', 'play']),
  },
  foodie: {
    unlockKey: 'foodie_still_hungry',
    eligibleActions: new Set(['feed']),
  },
}

// Picks the runtime post-action reaction animation token for a pet that has
// earned its temperament's Level 5 reaction unlock. Returns null when the
// temperament/action pair is not eligible, the unlock has not been earned,
// or the species has no matching animation so callers can preserve the
// current non-personality action reaction unchanged.
export function selectActionReactionAnimation({ species, temperament, action, earnedPersonalityUnlockKeys }) {
  if (!Array.isArray(earnedPersonalityUnlockKeys)) return null

  const reaction = LEVEL_5_ACTION_REACTIONS[temperament]
  if (!reaction || !reaction.eligibleActions.has(action)) return null
  if (!earnedPersonalityUnlockKeys.includes(reaction.unlockKey)) return null

  return getUnlockCelebrationAnimation(reaction.unlockKey, species)
}
