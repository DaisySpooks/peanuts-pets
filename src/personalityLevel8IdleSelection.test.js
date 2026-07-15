import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEVEL_8_HABIT_OPPORTUNITY_CHANCE,
  selectIdleAnimation,
} from './components/personalityIdleSelection.js'

test('each earned Level 8 unlock selects the correct habit token', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: ['playful_show_off'],
      fallbackAnimation: 'head-lift',
      level8OpportunityRoll: 0,
      opportunityRoll: 1,
    }),
    'show-off',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: ['curious_explorer'],
      fallbackAnimation: 'body-sway',
      level8OpportunityRoll: 0,
      opportunityRoll: 1,
    }),
    'explorer',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'turtle',
      earnedPersonalityUnlockKeys: ['gentle_peaceful_moment'],
      fallbackAnimation: 'head-tilt',
      level8OpportunityRoll: 0,
      opportunityRoll: 1,
    }),
    'peaceful-moment',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: ['sleepy_power_nap'],
      fallbackAnimation: 'fin-flare',
      level8OpportunityRoll: 0,
      opportunityRoll: 1,
    }),
    'power-nap',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: ['foodie_food_patrol'],
      fallbackAnimation: 'gill-flutter',
      level8OpportunityRoll: 0,
      opportunityRoll: 1,
    }),
    'food-patrol',
  )
})

test('locked Level 8 habits are never selected', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: [],
      fallbackAnimation: 'head-lift',
      level8OpportunityRoll: 0,
      opportunityRoll: 1,
    }),
    'head-lift',
  )
})

test('Level 8 habits are checked before Level 1 personality idles', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: ['playful_show_off', 'playful_happy_bounce'],
      fallbackAnimation: 'gill-flutter',
      level8OpportunityRoll: 0,
      opportunityRoll: 0,
    }),
    'show-off',
  )
})

test('falls back to Level 1 or normal idle when Level 8 is not selected', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'turtle',
      earnedPersonalityUnlockKeys: ['gentle_peaceful_moment', 'gentle_happy_wave'],
      fallbackAnimation: 'flipper-stretch',
      level8OpportunityRoll: LEVEL_8_HABIT_OPPORTUNITY_CHANCE,
      opportunityRoll: 0,
    }),
    'gentle-wave',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: ['curious_explorer'],
      fallbackAnimation: 'body-sway',
      level8OpportunityRoll: LEVEL_8_HABIT_OPPORTUNITY_CHANCE,
      opportunityRoll: 1,
    }),
    'body-sway',
  )
})

test('Food Patrol is suppressed immediately after Feed', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'axolotl',
      earnedPersonalityUnlockKeys: ['foodie_food_patrol', 'foodie_hungry_wiggle'],
      fallbackAnimation: 'head-lift',
      level8OpportunityRoll: 0,
      opportunityRoll: 0,
      suppressFoodPatrol: true,
    }),
    'hungry-wiggle',
  )
})

test('unknown data falls back safely', () => {
  assert.equal(
    selectIdleAnimation({
      species: 'hamster',
      earnedPersonalityUnlockKeys: ['playful_show_off'],
      fallbackAnimation: 'idle',
      level8OpportunityRoll: 0,
      opportunityRoll: 0,
    }),
    'idle',
  )
  assert.equal(
    selectIdleAnimation({
      species: 'betta',
      earnedPersonalityUnlockKeys: null,
      fallbackAnimation: 'body-sway',
      level8OpportunityRoll: 0,
      opportunityRoll: 0,
    }),
    'body-sway',
  )
})
