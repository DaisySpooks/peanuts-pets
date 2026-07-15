import { getAffectionLevelInfo } from './petAffectionLevels.js'
import { getUnlocksForTemperament } from './petPersonalityUnlocks.js'
import { recordPersonalityUnlock } from './petPersonalityUnlockRecords.js'

// Reconciles an existing pet's earned records with every milestone already
// reached. Level 1 is intentionally excluded at zero lifetime affection,
// because Level 1 is the starting floor rather than a crossed milestone.
export async function catchUpPersonalityUnlocks({
  pet,
  earnedPersonalityUnlockKeys,
  supabaseUrl,
  serviceRoleKey,
  discordUserId,
  recordUnlock = recordPersonalityUnlock,
}) {
  const earnedKeys = new Set(Array.isArray(earnedPersonalityUnlockKeys) ? earnedPersonalityUnlockKeys : [])
  const lifetimeAffection = Number.isFinite(pet?.lifetimeAffection)
    ? Math.max(0, Math.trunc(pet.lifetimeAffection))
    : 0
  const currentLevel = getAffectionLevelInfo(lifetimeAffection).level
  const eligibleUnlocks = getUnlocksForTemperament(pet?.temperament).filter((unlock) => (
    unlock.requiredLevel <= currentLevel
    && (unlock.requiredLevel !== 1 || lifetimeAffection > 0)
  ))
  const newlyGrantedPersonalities = []

  for (const unlock of eligibleUnlocks) {
    if (earnedKeys.has(unlock.unlockKey)) continue

    const recorded = await recordUnlock({
      supabaseUrl,
      serviceRoleKey,
      discordUserId,
      unlockKey: unlock.unlockKey,
      temperament: pet.temperament,
    })

    // A null result means another request already recorded this unlock.
    if (recorded) {
      newlyGrantedPersonalities.push(unlock)
      earnedKeys.add(unlock.unlockKey)
    }
  }

  return {
    earnedPersonalityUnlockKeys: [...earnedKeys],
    newlyGrantedPersonalities,
  }
}
