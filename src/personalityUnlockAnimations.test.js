import assert from 'node:assert/strict'
import test from 'node:test'

import { getUnlockCelebrationAnimation } from './components/personalityUnlockAnimations.js'

test('foodie snack check maps to the new Level 3 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('foodie_snack_check', 'axolotl'), 'snack-check')
  assert.equal(getUnlockCelebrationAnimation('foodie_snack_check', 'betta'), 'snack-check')
  assert.equal(getUnlockCelebrationAnimation('foodie_snack_check', 'turtle'), 'snack-check')
})

test('playful encore maps to the new Level 5 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('playful_encore', 'axolotl'), 'encore')
  assert.equal(getUnlockCelebrationAnimation('playful_encore', 'betta'), 'encore')
  assert.equal(getUnlockCelebrationAnimation('playful_encore', 'turtle'), 'encore')
})

test('playful show off maps to the new Level 8 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('playful_show_off', 'axolotl'), 'show-off')
  assert.equal(getUnlockCelebrationAnimation('playful_show_off', 'betta'), 'show-off')
  assert.equal(getUnlockCelebrationAnimation('playful_show_off', 'turtle'), 'show-off')
})

test('playful you’re here maps to the Level 12 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('playful_youre_here', 'axolotl'), 'youre-here')
  assert.equal(getUnlockCelebrationAnimation('playful_youre_here', 'betta'), 'youre-here')
  assert.equal(getUnlockCelebrationAnimation('playful_youre_here', 'turtle'), 'youre-here')
})

test('curious explorer maps to the new Level 8 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('curious_explorer', 'axolotl'), 'explorer')
  assert.equal(getUnlockCelebrationAnimation('curious_explorer', 'betta'), 'explorer')
  assert.equal(getUnlockCelebrationAnimation('curious_explorer', 'turtle'), 'explorer')
})

test('curious follow me maps to the Level 12 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('curious_follow_me', 'axolotl'), 'follow-me')
  assert.equal(getUnlockCelebrationAnimation('curious_follow_me', 'betta'), 'follow-me')
  assert.equal(getUnlockCelebrationAnimation('curious_follow_me', 'turtle'), 'follow-me')
})

test('curious what was that maps to the new Level 5 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('curious_what_was_that', 'axolotl'), 'what-was-that')
  assert.equal(getUnlockCelebrationAnimation('curious_what_was_that', 'betta'), 'what-was-that')
  assert.equal(getUnlockCelebrationAnimation('curious_what_was_that', 'turtle'), 'what-was-that')
})

test('gentle thank you maps to the new Level 5 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('gentle_thank_you', 'axolotl'), 'thank-you')
  assert.equal(getUnlockCelebrationAnimation('gentle_thank_you', 'betta'), 'thank-you')
  assert.equal(getUnlockCelebrationAnimation('gentle_thank_you', 'turtle'), 'thank-you')
})

test('gentle peaceful moment maps to the new Level 8 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('gentle_peaceful_moment', 'axolotl'), 'peaceful-moment')
  assert.equal(getUnlockCelebrationAnimation('gentle_peaceful_moment', 'betta'), 'peaceful-moment')
  assert.equal(getUnlockCelebrationAnimation('gentle_peaceful_moment', 'turtle'), 'peaceful-moment')
})

test('gentle happy together maps to the Level 12 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('gentle_happy_together', 'axolotl'), 'happy-together')
  assert.equal(getUnlockCelebrationAnimation('gentle_happy_together', 'betta'), 'happy-together')
  assert.equal(getUnlockCelebrationAnimation('gentle_happy_together', 'turtle'), 'happy-together')
})

test('sleepy cozy time maps to the new Level 5 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('sleepy_cozy_time', 'axolotl'), 'cozy-time')
  assert.equal(getUnlockCelebrationAnimation('sleepy_cozy_time', 'betta'), 'cozy-time')
  assert.equal(getUnlockCelebrationAnimation('sleepy_cozy_time', 'turtle'), 'cozy-time')
})

test('sleepy power nap maps to the new Level 8 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('sleepy_power_nap', 'axolotl'), 'power-nap')
  assert.equal(getUnlockCelebrationAnimation('sleepy_power_nap', 'betta'), 'power-nap')
  assert.equal(getUnlockCelebrationAnimation('sleepy_power_nap', 'turtle'), 'power-nap')
})

test('sleepy sleep beside you maps to the Level 12 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('sleepy_sleep_beside_you', 'axolotl'), 'sleep-beside-you')
  assert.equal(getUnlockCelebrationAnimation('sleepy_sleep_beside_you', 'betta'), 'sleep-beside-you')
  assert.equal(getUnlockCelebrationAnimation('sleepy_sleep_beside_you', 'turtle'), 'sleep-beside-you')
})

test('foodie still hungry maps to the new Level 5 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('foodie_still_hungry', 'axolotl'), 'still-hungry')
  assert.equal(getUnlockCelebrationAnimation('foodie_still_hungry', 'betta'), 'still-hungry')
  assert.equal(getUnlockCelebrationAnimation('foodie_still_hungry', 'turtle'), 'still-hungry')
})

test('foodie food patrol maps to the new Level 8 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('foodie_food_patrol', 'axolotl'), 'food-patrol')
  assert.equal(getUnlockCelebrationAnimation('foodie_food_patrol', 'betta'), 'food-patrol')
  assert.equal(getUnlockCelebrationAnimation('foodie_food_patrol', 'turtle'), 'food-patrol')
})

test('foodie sharing time maps to the Level 12 celebration token for all supported species', () => {
  assert.equal(getUnlockCelebrationAnimation('foodie_sharing_time', 'axolotl'), 'sharing-time')
  assert.equal(getUnlockCelebrationAnimation('foodie_sharing_time', 'betta'), 'sharing-time')
  assert.equal(getUnlockCelebrationAnimation('foodie_sharing_time', 'turtle'), 'sharing-time')
})

test('unknown unlocks or species still fall back to no special animation', () => {
  assert.equal(getUnlockCelebrationAnimation('foodie_snack_check', 'hamster'), null)
  assert.equal(getUnlockCelebrationAnimation('totally_unknown_unlock', 'axolotl'), null)
})
