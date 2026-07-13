import assert from 'node:assert/strict'
import test from 'node:test'

import { getRandomThoughtForTemperament, getThoughtsForTemperament } from './petThoughts.js'

const TEMPERAMENTS = ['playful', 'curious', 'gentle', 'sleepy', 'foodie']

test('valid temperament returns a thought', () => {
  for (const temperament of TEMPERAMENTS) {
    assert.ok(getRandomThoughtForTemperament(temperament))
  }
})

test('returned object contains both key and text', () => {
  const thought = getRandomThoughtForTemperament('playful')
  assert.equal(typeof thought.key, 'string')
  assert.equal(typeof thought.text, 'string')
  assert.ok(thought.key.length > 0)
  assert.ok(thought.text.length > 0)
})

test('unknown temperament is handled safely', () => {
  for (const temperament of [null, undefined, '', 'grumpy', 'PLAYFUL']) {
    assert.equal(getRandomThoughtForTemperament(temperament), null)
  }
})

test('random selection always comes from the correct temperament pool', () => {
  for (const temperament of TEMPERAMENTS) {
    for (const randomFn of [() => 0, () => 0.5, () => 0.999999]) {
      const thought = getRandomThoughtForTemperament(temperament, randomFn)
      assert.ok(thought.key.startsWith(`${temperament}_`))
    }
  }
})

test('getThoughtsForTemperament returns the full pool for a valid temperament', () => {
  for (const temperament of TEMPERAMENTS) {
    const thoughts = getThoughtsForTemperament(temperament)
    assert.equal(thoughts.length, 5)
    for (const thought of thoughts) {
      assert.ok(thought.key.startsWith(`${temperament}_`))
      assert.equal(typeof thought.text, 'string')
    }
  }
})

test('getThoughtsForTemperament returns a copy, not the shared table', () => {
  const thoughts = getThoughtsForTemperament('playful')
  thoughts[0].text = 'mutated'
  assert.notEqual(getThoughtsForTemperament('playful')[0].text, 'mutated')
})

test('getThoughtsForTemperament returns null for an unknown temperament', () => {
  for (const temperament of [null, undefined, '', 'grumpy', 'PLAYFUL']) {
    assert.equal(getThoughtsForTemperament(temperament), null)
  }
})
