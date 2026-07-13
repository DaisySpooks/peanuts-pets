import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getActionRestoreAmount,
  getPettingAffectionBonus,
  getStatDecayMultiplier,
} from './petTemperamentEffects.js'

test('playful restores 30 on play and decays happiness 10% faster', () => {
  assert.equal(getActionRestoreAmount('playful', 'play', 25), 30)
  assert.equal(getActionRestoreAmount('playful', 'feed', 25), 25)
  assert.equal(getStatDecayMultiplier('playful', 'happiness'), 1.1)
  assert.equal(getStatDecayMultiplier('playful', 'hunger'), 1)
})

test('curious grants +1 affection on petting and has no decay modifier', () => {
  assert.equal(getPettingAffectionBonus('curious'), 1)
  assert.equal(getStatDecayMultiplier('curious', 'happiness'), 1)
  assert.equal(getStatDecayMultiplier('curious', 'hunger'), 1)
  assert.equal(getStatDecayMultiplier('curious', 'cleanliness'), 1)
})

test('gentle decays happiness 10% slower with no other changes', () => {
  assert.equal(getStatDecayMultiplier('gentle', 'happiness'), 0.9)
  assert.equal(getActionRestoreAmount('gentle', 'play', 25), 25)
  assert.equal(getActionRestoreAmount('gentle', 'feed', 25), 25)
  assert.equal(getPettingAffectionBonus('gentle'), 0)
})

test('sleepy decays happiness 15% slower with no other changes', () => {
  assert.equal(getStatDecayMultiplier('sleepy', 'happiness'), 0.85)
  assert.equal(getActionRestoreAmount('sleepy', 'play', 25), 25)
  assert.equal(getPettingAffectionBonus('sleepy'), 0)
})

test('foodie restores 30 on feed and decays hunger 10% faster', () => {
  assert.equal(getActionRestoreAmount('foodie', 'feed', 25), 30)
  assert.equal(getActionRestoreAmount('foodie', 'play', 25), 25)
  assert.equal(getStatDecayMultiplier('foodie', 'hunger'), 1.1)
  assert.equal(getStatDecayMultiplier('foodie', 'happiness'), 1)
})

test('clean is never modified by any temperament', () => {
  for (const temperament of ['playful', 'curious', 'gentle', 'sleepy', 'foodie']) {
    assert.equal(getActionRestoreAmount(temperament, 'clean', 25), 25)
    assert.equal(getStatDecayMultiplier(temperament, 'cleanliness'), 1)
  }
})

test('missing or invalid temperament falls back to neutral baseline', () => {
  for (const temperament of [null, undefined, '', 'grumpy', 'PLAYFUL']) {
    assert.equal(getActionRestoreAmount(temperament, 'feed', 25), 25)
    assert.equal(getActionRestoreAmount(temperament, 'play', 25), 25)
    assert.equal(getStatDecayMultiplier(temperament, 'hunger'), 1)
    assert.equal(getStatDecayMultiplier(temperament, 'happiness'), 1)
    assert.equal(getStatDecayMultiplier(temperament, 'cleanliness'), 1)
    assert.equal(getPettingAffectionBonus(temperament), 0)
  }
})
