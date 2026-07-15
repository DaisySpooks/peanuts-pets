import assert from 'node:assert/strict'
import test from 'node:test'

import { cumulativeAffectionForLevel } from './petAffectionLevels.js'
import { catchUpPersonalityUnlocks } from './petPersonalityUnlockCatchUp.js'

function makePet(temperament, level) {
  return {
    temperament,
    lifetimeAffection: level === 1 ? 1 : cumulativeAffectionForLevel(level),
  }
}

function createRecorder(initialKeys = []) {
  const recorded = new Set(initialKeys)
  return {
    recorded,
    recordUnlock: async ({ unlockKey }) => {
      if (recorded.has(unlockKey)) return null
      recorded.add(unlockKey)
      return { unlockKey }
    },
  }
}

test('a Level 1 pet with prior affection receives its missing Level 1 unlock', async () => {
  const recorder = createRecorder()
  const result = await catchUpPersonalityUnlocks({
    pet: makePet('playful', 1),
    earnedPersonalityUnlockKeys: [],
    recordUnlock: recorder.recordUnlock,
  })

  assert.deepEqual(result.newlyGrantedPersonalities.map((unlock) => unlock.unlockKey), ['playful_happy_bounce'])
})

test('a Level 3 pet receives missing Level 1 and Level 3 unlocks in order', async () => {
  const result = await catchUpPersonalityUnlocks({
    pet: makePet('curious', 3),
    earnedPersonalityUnlockKeys: [],
    recordUnlock: createRecorder().recordUnlock,
  })

  assert.deepEqual(result.newlyGrantedPersonalities.map((unlock) => unlock.unlockKey), [
    'curious_curious_peek',
    'curious_whos_there',
  ])
})

test('Level 5, 8, and 12 pets receive every eligible missing milestone in order', async () => {
  for (const [level, temperament, expected] of [
    [5, 'gentle', ['gentle_happy_wave', 'gentle_warm_hello', 'gentle_thank_you']],
    [8, 'sleepy', ['sleepy_sleepy_stretch', 'sleepy_drowsy_greeting', 'sleepy_cozy_time', 'sleepy_power_nap']],
    [12, 'foodie', ['foodie_hungry_wiggle', 'foodie_snack_check', 'foodie_still_hungry', 'foodie_food_patrol', 'foodie_sharing_time']],
  ]) {
    const result = await catchUpPersonalityUnlocks({
      pet: makePet(temperament, level),
      earnedPersonalityUnlockKeys: [],
      recordUnlock: createRecorder().recordUnlock,
    })
    assert.deepEqual(result.newlyGrantedPersonalities.map((unlock) => unlock.unlockKey), expected)
  }
})

test('already-earned milestones are skipped', async () => {
  const recorder = createRecorder(['playful_happy_bounce'])
  const result = await catchUpPersonalityUnlocks({
    pet: makePet('playful', 3),
    earnedPersonalityUnlockKeys: ['playful_happy_bounce'],
    recordUnlock: recorder.recordUnlock,
  })

  assert.deepEqual(result.newlyGrantedPersonalities.map((unlock) => unlock.unlockKey), ['playful_playtime_welcome'])
})

test('zero-affection pets receive nothing', async () => {
  const result = await catchUpPersonalityUnlocks({
    pet: { temperament: 'gentle', lifetimeAffection: 0 },
    earnedPersonalityUnlockKeys: [],
    recordUnlock: createRecorder().recordUnlock,
  })

  assert.deepEqual(result.newlyGrantedPersonalities, [])
})

test('repeated load does not replay catch-up', async () => {
  const recorder = createRecorder()
  const pet = makePet('playful', 3)
  const first = await catchUpPersonalityUnlocks({
    pet,
    earnedPersonalityUnlockKeys: [],
    recordUnlock: recorder.recordUnlock,
  })
  const second = await catchUpPersonalityUnlocks({
    pet,
    earnedPersonalityUnlockKeys: first.earnedPersonalityUnlockKeys,
    recordUnlock: recorder.recordUnlock,
  })

  assert.equal(first.newlyGrantedPersonalities.length, 2)
  assert.deepEqual(second.newlyGrantedPersonalities, [])
})

test('wrong-temperament milestones are never granted', async () => {
  const result = await catchUpPersonalityUnlocks({
    pet: makePet('playful', 12),
    earnedPersonalityUnlockKeys: ['curious_curious_peek'],
    recordUnlock: createRecorder().recordUnlock,
  })

  assert.equal(result.newlyGrantedPersonalities.some((unlock) => unlock.unlockKey.startsWith('curious_')), false)
})
