export function buildPersonalityUnlockQueue(pet, newlyGrantedPersonalities) {
  if (!Array.isArray(newlyGrantedPersonalities)) return []
  return newlyGrantedPersonalities
    .filter((unlock) => typeof unlock?.unlockKey === 'string')
    .map((unlock) => ({ pet, unlock }))
}

export function advancePersonalityUnlockQueue(queue) {
  return Array.isArray(queue) ? queue.slice(1) : []
}
