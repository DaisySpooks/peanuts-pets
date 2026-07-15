import assert from 'node:assert/strict'
import test from 'node:test'

import { selectReturnGreetingAnimation } from './components/personalityGreetingSelection.js'

test('each earned Level 3 unlock selects the correct runtime greeting token', () => {
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'axolotl',
      temperament: 'playful',
      earnedPersonalityUnlockKeys: ['playful_playtime_welcome'],
    }),
    'playtime-welcome',
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'betta',
      temperament: 'curious',
      earnedPersonalityUnlockKeys: ['curious_whos_there'],
    }),
    'curious-greeting',
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'turtle',
      temperament: 'gentle',
      earnedPersonalityUnlockKeys: ['gentle_warm_hello'],
    }),
    'warm-hello',
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'betta',
      temperament: 'sleepy',
      earnedPersonalityUnlockKeys: ['sleepy_drowsy_greeting'],
    }),
    'drowsy-greeting',
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'turtle',
      temperament: 'foodie',
      earnedPersonalityUnlockKeys: ['foodie_snack_check'],
    }),
    'snack-check',
  )
})

test('locked Level 3 greetings fall back to the existing generic greeting behavior', () => {
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'axolotl',
      temperament: 'playful',
      earnedPersonalityUnlockKeys: [],
    }),
    null,
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'betta',
      temperament: 'curious',
      earnedPersonalityUnlockKeys: ['curious_curious_peek'],
    }),
    null,
  )
})

test('unknown temperament or unlock data falls back safely', () => {
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'axolotl',
      temperament: 'mysterious',
      earnedPersonalityUnlockKeys: ['playful_playtime_welcome'],
    }),
    null,
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'hamster',
      temperament: 'playful',
      earnedPersonalityUnlockKeys: ['playful_playtime_welcome'],
    }),
    null,
  )
  assert.equal(
    selectReturnGreetingAnimation({
      species: 'turtle',
      temperament: 'foodie',
      earnedPersonalityUnlockKeys: null,
    }),
    null,
  )
})
