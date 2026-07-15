import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advancePersonalityUnlockQueue,
  buildPersonalityUnlockQueue,
} from './personalityUnlockQueue.js'

test('frontend unlock queue advances in order and clears after the final celebration', () => {
  const pet = { petName: 'Mochi' }
  const queue = buildPersonalityUnlockQueue(pet, [
    { unlockKey: 'playful_happy_bounce' },
    { unlockKey: 'playful_playtime_welcome' },
  ])

  assert.equal(queue[0].unlock.unlockKey, 'playful_happy_bounce')
  const afterFirst = advancePersonalityUnlockQueue(queue)
  assert.equal(afterFirst[0].unlock.unlockKey, 'playful_playtime_welcome')
  assert.deepEqual(advancePersonalityUnlockQueue(afterFirst), [])
})

test('frontend queue safely ignores missing unlock arrays and malformed entries', () => {
  assert.deepEqual(buildPersonalityUnlockQueue({ petName: 'Mochi' }, null), [])
  assert.deepEqual(buildPersonalityUnlockQueue({ petName: 'Mochi' }, [{ displayName: 'broken' }]), [])
  assert.deepEqual(advancePersonalityUnlockQueue(null), [])
})
