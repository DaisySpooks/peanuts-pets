import assert from 'node:assert/strict'
import test from 'node:test'

import { cumulativeAffectionForLevel } from './petAffectionLevels.js'
import {
  detectNewlyUnlockedPersonality,
  getUnlockForTemperamentAndLevel,
  getUnlocksForTemperament,
} from './petPersonalityUnlocks.js'

test('each temperament maps to its correct Level 1 unlock', () => {
  assert.equal(getUnlockForTemperamentAndLevel('playful', 1).displayName, 'Happy Bounce')
  assert.equal(getUnlockForTemperamentAndLevel('curious', 1).displayName, 'Curious Peek')
  assert.equal(getUnlockForTemperamentAndLevel('gentle', 1).displayName, 'Happy Wave')
  assert.equal(getUnlockForTemperamentAndLevel('sleepy', 1).displayName, 'Sleepy Stretch')
  assert.equal(getUnlockForTemperamentAndLevel('foodie', 1).displayName, 'Hungry Wiggle')
})

test('each temperament maps to its correct Level 3, Level 5, and Level 8 unlocks', () => {
  const expectedByTemperament = {
    playful: {
      3: {
        unlockKey: 'playful_playtime_welcome',
        requiredLevel: 3,
        displayName: 'Playtime Welcome',
        description: 'Your playful pet has learned an excited way to greet you.',
      },
      5: {
        unlockKey: 'playful_encore',
        requiredLevel: 5,
        displayName: 'Encore!',
        description: 'Your playful pet now asks for one more round after playtime.',
      },
      8: {
        unlockKey: 'playful_show_off',
        requiredLevel: 8,
        displayName: 'Show Off',
        description: 'Your playful pet has started performing little tricks on its own.',
      },
      12: {
        unlockKey: 'playful_youre_here',
        requiredLevel: 12,
        displayName: 'You’re Here!',
        description: 'Your playful pet has become deeply attached and lights up when you return.',
      },
    },
    curious: {
      3: {
        unlockKey: 'curious_whos_there',
        requiredLevel: 3,
        displayName: 'Who’s There?',
        description: 'Your curious pet has started greeting you with a closer look.',
      },
      5: {
        unlockKey: 'curious_what_was_that',
        requiredLevel: 5,
        displayName: 'What Was That?',
        description: 'Your curious pet now pauses to investigate after care and play.',
      },
      8: {
        unlockKey: 'curious_explorer',
        requiredLevel: 8,
        displayName: 'Explorer',
        description: 'Your curious pet has started investigating different parts of its habitat.',
      },
      12: {
        unlockKey: 'curious_follow_me',
        requiredLevel: 12,
        displayName: 'Follow Me',
        description: 'Your curious pet now wants to share its discoveries with you.',
      },
    },
    gentle: {
      3: {
        unlockKey: 'gentle_warm_hello',
        requiredLevel: 3,
        displayName: 'Warm Hello',
        description: 'Your gentle pet has learned a calm, affectionate greeting.',
      },
      5: {
        unlockKey: 'gentle_thank_you',
        requiredLevel: 5,
        displayName: 'Thank You',
        description: 'Your gentle pet now shows appreciation after being cared for.',
      },
      8: {
        unlockKey: 'gentle_peaceful_moment',
        requiredLevel: 8,
        displayName: 'Peaceful Moment',
        description: 'Your gentle pet now enjoys quiet moments of contentment.',
      },
      12: {
        unlockKey: 'gentle_happy_together',
        requiredLevel: 12,
        displayName: 'Happy Together',
        description: 'Your gentle pet is happiest simply spending quiet time with you.',
      },
    },
    sleepy: {
      3: {
        unlockKey: 'sleepy_drowsy_greeting',
        requiredLevel: 3,
        displayName: 'Drowsy Greeting',
        description: 'Your sleepy pet wakes gently to greet you.',
      },
      5: {
        unlockKey: 'sleepy_cozy_time',
        requiredLevel: 5,
        displayName: 'Cozy Time',
        description: 'Your sleepy pet now settles into a cozy moment after care.',
      },
      8: {
        unlockKey: 'sleepy_power_nap',
        requiredLevel: 8,
        displayName: 'Power Nap',
        description: 'Your sleepy pet feels safe enough to nap while you are nearby.',
      },
      12: {
        unlockKey: 'sleepy_sleep_beside_you',
        requiredLevel: 12,
        displayName: 'Sleep Beside You',
        description: 'Your sleepy pet trusts you enough to rest close by.',
      },
    },
    foodie: {
      3: {
        unlockKey: 'foodie_snack_check',
        requiredLevel: 3,
        displayName: 'Snack Check',
        description: 'Your foodie pet now greets you before checking for snacks.',
      },
      5: {
        unlockKey: 'foodie_still_hungry',
        requiredLevel: 5,
        displayName: 'Still Hungry',
        description: 'Your foodie pet now quietly hopes for another bite after eating.',
      },
      8: {
        unlockKey: 'foodie_food_patrol',
        requiredLevel: 8,
        displayName: 'Food Patrol',
        description: 'Your foodie pet has started checking the feeding area for snacks.',
      },
      12: {
        unlockKey: 'foodie_sharing_time',
        requiredLevel: 12,
        displayName: 'Sharing Time',
        description: 'Your foodie pet now checks in with you before thinking about snacks.',
      },
    },
  }

  for (const [temperament, expectedLevels] of Object.entries(expectedByTemperament)) {
    for (const [level, expectedUnlock] of Object.entries(expectedLevels)) {
      assert.deepEqual(getUnlockForTemperamentAndLevel(temperament, Number(level)), expectedUnlock, `${temperament} level ${level}`)
    }
  }
})

test('milestones stay ordered by required level for every temperament', () => {
  for (const temperament of ['playful', 'curious', 'gentle', 'sleepy', 'foodie']) {
    assert.deepEqual(
      getUnlocksForTemperament(temperament).map((unlock) => unlock.requiredLevel),
      [1, 3, 5, 8, 12],
      temperament,
    )
  }
})

test('unknown or missing temperament has no unlocks', () => {
  assert.deepEqual(getUnlocksForTemperament('grumpy'), [])
  assert.deepEqual(getUnlocksForTemperament(null), [])
  assert.equal(getUnlockForTemperamentAndLevel(null, 1), undefined)
})

test('unknown temperament or level lookup still returns nothing', () => {
  assert.equal(getUnlockForTemperamentAndLevel('grumpy', 3), undefined)
  assert.equal(getUnlockForTemperamentAndLevel('playful', 13), undefined)
  assert.equal(getUnlockForTemperamentAndLevel('foodie', 13), undefined)
})

// getAffectionLevelInfo treats 0 lifetime affection as Level 1 (every pet's
// starting level), so there's no lower level to cross from via level
// comparison alone. The Level 1 milestone instead fires on the very first
// ever affection gain: previous lifetime affection was exactly 0 and this
// change raised it above 0.
test('a brand new pet gaining its first affection unlocks the Level 1 personality', () => {
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'playful',
    previousLifetimeAffection: 0,
    nextLifetimeAffection: 1,
  })
  assert.equal(unlock?.displayName, 'Happy Bounce')
})

test('a second affection gain within Level 1 does not re-trigger the unlock', () => {
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'playful',
    previousLifetimeAffection: 1,
    nextLifetimeAffection: 2,
  })
  assert.equal(unlock, null)
})

test('a pet that already had lifetime affection before this action never retroactively unlocks', () => {
  // Simulates an existing owner already at Level 1+ (or beyond) taking a
  // fresh action — previousLifetimeAffection is non-zero, so this is not
  // their first-ever affection gain and must not fire the celebration.
  for (const previousLifetimeAffection of [5, 25, 140]) {
    const unlock = detectNewlyUnlockedPersonality({
      temperament: 'sleepy',
      previousLifetimeAffection,
      nextLifetimeAffection: previousLifetimeAffection + 1,
    })
    assert.equal(unlock, null)
  }
})

test('crossing from below Level 3 into Level 3 returns the temperament-specific Level 3 unlock', () => {
  const level3At = cumulativeAffectionForLevel(3)
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'foodie',
    previousLifetimeAffection: level3At - 1,
    nextLifetimeAffection: level3At,
  })
  assert.equal(unlock?.unlockKey, 'foodie_snack_check')
})

test('crossing from below Level 5 into Level 5 returns the temperament-specific Level 5 unlock', () => {
  const level5At = cumulativeAffectionForLevel(5)
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'sleepy',
    previousLifetimeAffection: level5At - 1,
    nextLifetimeAffection: level5At,
  })
  assert.equal(unlock?.unlockKey, 'sleepy_cozy_time')
})

test('remaining within the same affection level does not create a new unlock', () => {
  const level3At = cumulativeAffectionForLevel(3)
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'gentle',
    previousLifetimeAffection: level3At,
    nextLifetimeAffection: level3At + 1,
  })
  assert.equal(unlock, null)
})

test('skipping across multiple milestones in one jump returns only the highest crossed unlock', () => {
  const level3At = cumulativeAffectionForLevel(3)
  const level5At = cumulativeAffectionForLevel(5)
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'playful',
    previousLifetimeAffection: level3At - 1,
    nextLifetimeAffection: level5At,
  })
  assert.equal(unlock?.unlockKey, 'playful_encore')
})

test('no unlock fires when affection does not change at all', () => {
  const unlock = detectNewlyUnlockedPersonality({
    temperament: 'gentle',
    previousLifetimeAffection: 0,
    nextLifetimeAffection: 0,
  })
  assert.equal(unlock, null)
})

test('missing/invalid temperament never unlocks anything, even on a first gain', () => {
  for (const temperament of [null, undefined, '', 'grumpy']) {
    const unlock = detectNewlyUnlockedPersonality({
      temperament,
      previousLifetimeAffection: 0,
      nextLifetimeAffection: 1,
    })
    assert.equal(unlock, null)
  }
})

test('each temperament unlocks its own personality on first affection gain, not another\'s', () => {
  const expected = {
    playful: 'Happy Bounce',
    curious: 'Curious Peek',
    gentle: 'Happy Wave',
    sleepy: 'Sleepy Stretch',
    foodie: 'Hungry Wiggle',
  }
  for (const [temperament, displayName] of Object.entries(expected)) {
    const unlock = detectNewlyUnlockedPersonality({
      temperament,
      previousLifetimeAffection: 0,
      nextLifetimeAffection: 1,
    })
    assert.equal(unlock?.displayName, displayName)
  }
})
