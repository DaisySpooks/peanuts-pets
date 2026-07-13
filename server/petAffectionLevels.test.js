import assert from 'node:assert/strict'
import test from 'node:test'

import { cumulativeAffectionForLevel, getAffectionLevelInfo } from './petAffectionLevels.js'

test('zero affection is level 1 with progress toward the level 2 threshold', () => {
  assert.deepEqual(getAffectionLevelInfo(0), {
    level: 1,
    levelProgress: 0,
    levelProgressRequired: 10,
    nextLevelAt: 10,
  })
})

test('values between thresholds report progress within the current level', () => {
  assert.deepEqual(getAffectionLevelInfo(18), {
    level: 2,
    levelProgress: 8,
    levelProgressRequired: 15,
    nextLevelAt: 25,
  })
})

test('exact threshold boundaries advance to the new level with zero progress', () => {
  assert.deepEqual(getAffectionLevelInfo(10), {
    level: 2,
    levelProgress: 0,
    levelProgressRequired: 15,
    nextLevelAt: 25,
  })
  assert.deepEqual(getAffectionLevelInfo(25), {
    level: 3,
    levelProgress: 0,
    levelProgressRequired: 25,
    nextLevelAt: 50,
  })
  assert.deepEqual(getAffectionLevelInfo(140), {
    level: 6,
    levelProgress: 0,
    levelProgressRequired: 60,
    nextLevelAt: 200,
  })
})

test('one below a threshold stays at the lower level', () => {
  assert.deepEqual(getAffectionLevelInfo(9), {
    level: 1,
    levelProgress: 9,
    levelProgressRequired: 10,
    nextLevelAt: 10,
  })
  assert.deepEqual(getAffectionLevelInfo(24), {
    level: 2,
    levelProgress: 14,
    levelProgressRequired: 15,
    nextLevelAt: 25,
  })
})

test('levels beyond the initial table keep growing by a predictable formula', () => {
  assert.equal(cumulativeAffectionForLevel(6), 140)
  assert.equal(cumulativeAffectionForLevel(7), 200)
  assert.equal(cumulativeAffectionForLevel(8), 270)
  assert.equal(cumulativeAffectionForLevel(9), 350)

  assert.deepEqual(getAffectionLevelInfo(150), {
    level: 6,
    levelProgress: 10,
    levelProgressRequired: 60,
    nextLevelAt: 200,
  })
  assert.deepEqual(getAffectionLevelInfo(270), {
    level: 8,
    levelProgress: 0,
    levelProgressRequired: 80,
    nextLevelAt: 350,
  })
})

test('non-finite or negative lifetime affection safely falls back to level 1', () => {
  assert.deepEqual(getAffectionLevelInfo(Number.NaN), {
    level: 1,
    levelProgress: 0,
    levelProgressRequired: 10,
    nextLevelAt: 10,
  })
  assert.deepEqual(getAffectionLevelInfo(-5), {
    level: 1,
    levelProgress: 0,
    levelProgressRequired: 10,
    nextLevelAt: 10,
  })
})
