import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PERSONALITY_IDLE_OPPORTUNITY_CHANCE,
  isLevel1PersonalityIdleAnimation,
  selectIdleAnimation,
} from './components/personalityIdleSelection.js'

test('correct Level 1 idle token is selected only when its unlock key exists', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: ['playful_happy_bounce'],
      fallbackAnimation: 'head-lift',
      opportunityRoll: 0,
    }),
    'happy-bounce',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: ['curious_curious_peek'],
      fallbackAnimation: 'body-sway',
      opportunityRoll: 0,
    }),
    'curious-peek',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'turtle',
      earnedPersonalityUnlockKeys: ['gentle_happy_wave'],
      fallbackAnimation: 'head-tilt',
      opportunityRoll: 0,
    }),
    'gentle-wave',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: ['sleepy_sleepy_stretch'],
      fallbackAnimation: 'fin-flare',
      opportunityRoll: 0,
    }),
    'sleepy-stretch',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'turtle',
      earnedPersonalityUnlockKeys: ['foodie_hungry_wiggle'],
      fallbackAnimation: 'flipper-stretch',
      opportunityRoll: 0,
    }),
    'hungry-wiggle',
  )
})

test('locked personality idle is never selected', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: [],
      fallbackAnimation: 'gill-flutter',
      opportunityRoll: 0,
    }),
    'gill-flutter',
  )
})

test('normal idle fallback still works when no personality idle is selected', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: ['playful_happy_bounce'],
      fallbackAnimation: 'body-sway',
      opportunityRoll: PERSONALITY_IDLE_OPPORTUNITY_CHANCE,
    }),
    'body-sway',
  )
})

test('only Level 1 personality idle tokens are recognized as runtime personality idles', () => {
  assert.equal(isLevel1PersonalityIdleAnimation('happy-bounce'), true)
  assert.equal(isLevel1PersonalityIdleAnimation('curious-greeting'), false)
  assert.equal(isLevel1PersonalityIdleAnimation('cozy-time'), false)
})
