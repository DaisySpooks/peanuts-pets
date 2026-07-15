import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEVEL_12_ATTACHMENT_OPPORTUNITY_CHANCE,
  selectReturnAttachmentAnimation,
} from './components/personalityAttachmentSelection.js'

const cases = [
  ['playful', 'playful_playtime_welcome', 'playful_youre_here', 'playtime-welcome', 'youre-here', 'turtle'],
  ['curious', 'curious_whos_there', 'curious_follow_me', 'curious-greeting', 'follow-me', 'betta'],
  ['gentle', 'gentle_warm_hello', 'gentle_happy_together', 'warm-hello', 'happy-together', 'axolotl'],
  ['sleepy', 'sleepy_drowsy_greeting', 'sleepy_sleep_beside_you', 'drowsy-greeting', 'sleep-beside-you', 'turtle'],
  ['foodie', 'foodie_snack_check', 'foodie_sharing_time', 'snack-check', 'sharing-time', 'betta'],
]

test('each earned Level 12 unlock selects its matching attachment token', () => {
  for (const [temperament, level3Key, level12Key, level3Token, level12Token, species] of cases) {
    assert.equal(
      selectReturnAttachmentAnimation({
        species,
        temperament,
        earnedPersonalityUnlockKeys: [level3Key, level12Key],
        greetingAnimation: level3Token,
        random: () => 0,
      }),
      level12Token,
      temperament,
    )
  }
})

test('Level 12 is eligible only after the matching Level 3 greeting', () => {
  const base = {
    species: 'turtle',
    temperament: 'playful',
    earnedPersonalityUnlockKeys: ['playful_playtime_welcome', 'playful_youre_here'],
    random: () => 0,
  }
  assert.equal(selectReturnAttachmentAnimation({ ...base, greetingAnimation: 'wrong-greeting' }), null)
  assert.equal(selectReturnAttachmentAnimation({ ...base, greetingAnimation: 'playtime-welcome' }), 'youre-here')
})

test('missing Level 3 unlock prevents Level 12 attachment selection', () => {
  assert.equal(selectReturnAttachmentAnimation({
    species: 'turtle',
    temperament: 'sleepy',
    earnedPersonalityUnlockKeys: ['sleepy_sleep_beside_you'],
    greetingAnimation: 'sleep-beside-you',
    random: () => 0,
  }), null)
})

test('the 25% opportunity uses injected random control', () => {
  const base = {
    species: 'betta',
    temperament: 'foodie',
    earnedPersonalityUnlockKeys: ['foodie_snack_check', 'foodie_sharing_time'],
    greetingAnimation: 'snack-check',
  }
  assert.equal(LEVEL_12_ATTACHMENT_OPPORTUNITY_CHANCE, 0.25)
  assert.equal(selectReturnAttachmentAnimation({ ...base, random: () => 0.24 }), 'sharing-time')
  assert.equal(selectReturnAttachmentAnimation({ ...base, random: () => 0.25 }), null)
})

test('missing or unknown unlock data falls back safely', () => {
  assert.equal(selectReturnAttachmentAnimation({
    species: 'turtle',
    temperament: 'unknown',
    earnedPersonalityUnlockKeys: ['unknown_unlock'],
    greetingAnimation: 'unknown-animation',
    random: () => 0,
  }), null)
  assert.equal(selectReturnAttachmentAnimation({
    species: 'hamster',
    temperament: 'playful',
    earnedPersonalityUnlockKeys: ['playful_playtime_welcome', 'playful_youre_here'],
    greetingAnimation: 'unknown-animation',
    random: () => 0,
  }), null)
  assert.equal(selectReturnAttachmentAnimation({
    species: 'turtle',
    temperament: 'playful',
    earnedPersonalityUnlockKeys: null,
    greetingAnimation: 'playtime-welcome',
    random: () => 0,
  }), null)
})

test('one greeting completion selects at most one Level 12 attachment', () => {
  let completionCount = 0
  const selectOnce = () => {
    if (completionCount > 0) return null
    completionCount += 1
    return selectReturnAttachmentAnimation({
      species: 'axolotl',
      temperament: 'gentle',
      earnedPersonalityUnlockKeys: ['gentle_warm_hello', 'gentle_happy_together'],
      greetingAnimation: 'warm-hello',
      random: () => 0,
    })
  }
  assert.equal(selectOnce(), 'happy-together')
  assert.equal(selectOnce(), null)
  assert.equal(completionCount, 1)
})
