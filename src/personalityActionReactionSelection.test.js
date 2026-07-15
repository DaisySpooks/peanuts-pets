import assert from 'node:assert/strict'
import test from 'node:test'

import { selectActionReactionAnimation } from './components/personalityActionReactionSelection.js'

test('each Level 5 unlock selects the correct reaction for its eligible actions', () => {
  assert.equal(
    selectActionReactionAnimation({
      species: 'axolotl',
      temperament: 'playful',
      action: 'play',
      earnedPersonalityUnlockKeys: ['playful_encore'],
    }),
    'encore',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'betta',
      temperament: 'curious',
      action: 'clean',
      earnedPersonalityUnlockKeys: ['curious_what_was_that'],
    }),
    'what-was-that',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'turtle',
      temperament: 'curious',
      action: 'play',
      earnedPersonalityUnlockKeys: ['curious_what_was_that'],
    }),
    'what-was-that',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'axolotl',
      temperament: 'gentle',
      action: 'treat',
      earnedPersonalityUnlockKeys: ['gentle_thank_you'],
    }),
    'thank-you',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'betta',
      temperament: 'gentle',
      action: 'pet',
      earnedPersonalityUnlockKeys: ['gentle_thank_you'],
    }),
    'thank-you',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'turtle',
      temperament: 'sleepy',
      action: 'feed',
      earnedPersonalityUnlockKeys: ['sleepy_cozy_time'],
    }),
    'cozy-time',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'betta',
      temperament: 'sleepy',
      action: 'play',
      earnedPersonalityUnlockKeys: ['sleepy_cozy_time'],
    }),
    'cozy-time',
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'axolotl',
      temperament: 'foodie',
      action: 'feed',
      earnedPersonalityUnlockKeys: ['foodie_still_hungry'],
    }),
    'still-hungry',
  )
})

test('ineligible actions return no personality reaction', () => {
  assert.equal(
    selectActionReactionAnimation({
      species: 'axolotl',
      temperament: 'playful',
      action: 'feed',
      earnedPersonalityUnlockKeys: ['playful_encore'],
    }),
    null,
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'betta',
      temperament: 'curious',
      action: 'treat',
      earnedPersonalityUnlockKeys: ['curious_what_was_that'],
    }),
    null,
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'turtle',
      temperament: 'foodie',
      action: 'play',
      earnedPersonalityUnlockKeys: ['foodie_still_hungry'],
    }),
    null,
  )
})

test('missing or unknown unlock data falls back safely', () => {
  assert.equal(
    selectActionReactionAnimation({
      species: 'axolotl',
      temperament: 'gentle',
      action: 'feed',
      earnedPersonalityUnlockKeys: [],
    }),
    null,
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'hamster',
      temperament: 'sleepy',
      action: 'play',
      earnedPersonalityUnlockKeys: ['sleepy_cozy_time'],
    }),
    null,
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'betta',
      temperament: 'mysterious',
      action: 'play',
      earnedPersonalityUnlockKeys: ['playful_encore'],
    }),
    null,
  )
  assert.equal(
    selectActionReactionAnimation({
      species: 'turtle',
      temperament: 'foodie',
      action: 'feed',
      earnedPersonalityUnlockKeys: null,
    }),
    null,
  )
})
