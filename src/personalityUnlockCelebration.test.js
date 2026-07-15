import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dismissPersonalityUnlockCelebration,
  getPersonalityUnlockCelebration,
} from './personalityUnlockCelebration.js'

const UNLOCK = {
  unlockKey: 'playful_happy_bounce',
  requiredLevel: 1,
  displayName: 'Happy Bounce',
  description: 'Your playful pet is comfortable enough to show its excitement.',
}

test('a pet response carrying a newly-earned unlock shows the correct unlock', () => {
  const pet = { petName: 'Mochi', newlyUnlockedPersonality: UNLOCK }
  const celebration = getPersonalityUnlockCelebration(pet)

  assert.notEqual(celebration, null)
  assert.equal(celebration.unlock, UNLOCK)
  assert.equal(celebration.pet, pet)
})

test('a pet response with no newly-earned unlock shows nothing', () => {
  assert.equal(getPersonalityUnlockCelebration({ petName: 'Mochi', newlyUnlockedPersonality: null }), null)
  assert.equal(getPersonalityUnlockCelebration({ petName: 'Mochi' }), null)
})

test('a missing pet response shows nothing', () => {
  assert.equal(getPersonalityUnlockCelebration(null), null)
  assert.equal(getPersonalityUnlockCelebration(undefined), null)
})

test('dismissing clears the celebration regardless of what was showing', () => {
  assert.equal(dismissPersonalityUnlockCelebration(), null)
})
