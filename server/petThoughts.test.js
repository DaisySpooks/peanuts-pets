import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getGreetingsForTemperament,
  getRandomGreetingForTemperament,
  getRandomThoughtForTemperament,
  getThoughtsForTemperament,
} from './petThoughts.js'

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

test('valid temperament returns a greeting', () => {
  for (const temperament of TEMPERAMENTS) {
    assert.ok(getRandomGreetingForTemperament(temperament))
  }
})

test('greeting object contains both key and text', () => {
  const greeting = getRandomGreetingForTemperament('playful')
  assert.equal(typeof greeting.key, 'string')
  assert.equal(typeof greeting.text, 'string')
  assert.ok(greeting.key.length > 0)
  assert.ok(greeting.text.length > 0)
})

test('unknown temperament returns no greeting', () => {
  for (const temperament of [null, undefined, '', 'grumpy', 'PLAYFUL']) {
    assert.equal(getRandomGreetingForTemperament(temperament), null)
  }
})

test('random greeting selection always comes from the correct temperament pool', () => {
  for (const temperament of TEMPERAMENTS) {
    for (const randomFn of [() => 0, () => 0.5, () => 0.999999]) {
      const greeting = getRandomGreetingForTemperament(temperament, randomFn)
      assert.ok(greeting.key.startsWith(`${temperament}_`))
    }
  }
})

test('getGreetingsForTemperament returns the full pool for a valid temperament', () => {
  for (const temperament of TEMPERAMENTS) {
    const greetings = getGreetingsForTemperament(temperament)
    assert.equal(greetings.length, 5)
    for (const greeting of greetings) {
      assert.ok(greeting.key.startsWith(`${temperament}_`))
      assert.equal(typeof greeting.text, 'string')
    }
  }
})

test('getGreetingsForTemperament returns a copy, not the shared table', () => {
  const greetings = getGreetingsForTemperament('playful')
  greetings[0].text = 'mutated'
  assert.notEqual(getGreetingsForTemperament('playful')[0].text, 'mutated')
})

test('getGreetingsForTemperament returns null for an unknown temperament', () => {
  for (const temperament of [null, undefined, '', 'grumpy', 'PLAYFUL']) {
    assert.equal(getGreetingsForTemperament(temperament), null)
  }
})

test('greeting pool text is distinct from the idle thought pool (separate tables)', () => {
  for (const temperament of TEMPERAMENTS) {
    const greetingTexts = new Set(getGreetingsForTemperament(temperament).map((g) => g.text))
    const thoughtTexts = getThoughtsForTemperament(temperament).map((t) => t.text)
    for (const text of thoughtTexts) {
      assert.ok(!greetingTexts.has(text))
    }
  }
})
