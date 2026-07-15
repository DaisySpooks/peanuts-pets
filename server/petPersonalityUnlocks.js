// Single source of truth for temperament-based personality unlocks. Each
// entry is keyed by temperament and lists the milestones (by affection
// level) that temperament unlocks, so routes/UI read this table instead of
// duplicating level/temperament checks. Additional milestones slot into the
// same per-temperament arrays without changing the shape consumers rely on.
import { getAffectionLevelInfo } from './petAffectionLevels.js'

const PERSONALITY_UNLOCKS = {
  playful: [
    {
      unlockKey: 'playful_happy_bounce',
      requiredLevel: 1,
      displayName: 'Happy Bounce',
      description: 'Your playful pet is comfortable enough to show its excitement.',
    },
    {
      unlockKey: 'playful_playtime_welcome',
      requiredLevel: 3,
      displayName: 'Playtime Welcome',
      description: 'Your playful pet has learned an excited way to greet you.',
    },
    {
      unlockKey: 'playful_encore',
      requiredLevel: 5,
      displayName: 'Encore!',
      description: 'Your playful pet now asks for one more round after playtime.',
    },
    {
      unlockKey: 'playful_show_off',
      requiredLevel: 8,
      displayName: 'Show Off',
      description: 'Your playful pet has started performing little tricks on its own.',
    },
    {
      unlockKey: 'playful_youre_here',
      requiredLevel: 12,
      displayName: 'You’re Here!',
      description: 'Your playful pet has become deeply attached and lights up when you return.',
    },
  ],
  curious: [
    {
      unlockKey: 'curious_curious_peek',
      requiredLevel: 1,
      displayName: 'Curious Peek',
      description: 'Your curious pet has started paying closer attention to the world around it.',
    },
    {
      unlockKey: 'curious_whos_there',
      requiredLevel: 3,
      displayName: 'Who’s There?',
      description: 'Your curious pet has started greeting you with a closer look.',
    },
    {
      unlockKey: 'curious_what_was_that',
      requiredLevel: 5,
      displayName: 'What Was That?',
      description: 'Your curious pet now pauses to investigate after care and play.',
    },
    {
      unlockKey: 'curious_explorer',
      requiredLevel: 8,
      displayName: 'Explorer',
      description: 'Your curious pet has started investigating different parts of its habitat.',
    },
    {
      unlockKey: 'curious_follow_me',
      requiredLevel: 12,
      displayName: 'Follow Me',
      description: 'Your curious pet now wants to share its discoveries with you.',
    },
  ],
  gentle: [
    {
      unlockKey: 'gentle_happy_wave',
      requiredLevel: 1,
      displayName: 'Happy Wave',
      description: 'Your gentle pet has learned a warm little way to greet you.',
    },
    {
      unlockKey: 'gentle_warm_hello',
      requiredLevel: 3,
      displayName: 'Warm Hello',
      description: 'Your gentle pet has learned a calm, affectionate greeting.',
    },
    {
      unlockKey: 'gentle_thank_you',
      requiredLevel: 5,
      displayName: 'Thank You',
      description: 'Your gentle pet now shows appreciation after being cared for.',
    },
    {
      unlockKey: 'gentle_peaceful_moment',
      requiredLevel: 8,
      displayName: 'Peaceful Moment',
      description: 'Your gentle pet now enjoys quiet moments of contentment.',
    },
    {
      unlockKey: 'gentle_happy_together',
      requiredLevel: 12,
      displayName: 'Happy Together',
      description: 'Your gentle pet is happiest simply spending quiet time with you.',
    },
  ],
  sleepy: [
    {
      unlockKey: 'sleepy_sleepy_stretch',
      requiredLevel: 1,
      displayName: 'Sleepy Stretch',
      description: 'Your sleepy pet feels comfortable enough to relax around you.',
    },
    {
      unlockKey: 'sleepy_drowsy_greeting',
      requiredLevel: 3,
      displayName: 'Drowsy Greeting',
      description: 'Your sleepy pet wakes gently to greet you.',
    },
    {
      unlockKey: 'sleepy_cozy_time',
      requiredLevel: 5,
      displayName: 'Cozy Time',
      description: 'Your sleepy pet now settles into a cozy moment after care.',
    },
    {
      unlockKey: 'sleepy_power_nap',
      requiredLevel: 8,
      displayName: 'Power Nap',
      description: 'Your sleepy pet feels safe enough to nap while you are nearby.',
    },
    {
      unlockKey: 'sleepy_sleep_beside_you',
      requiredLevel: 12,
      displayName: 'Sleep Beside You',
      description: 'Your sleepy pet trusts you enough to rest close by.',
    },
  ],
  foodie: [
    {
      unlockKey: 'foodie_hungry_wiggle',
      requiredLevel: 1,
      displayName: 'Hungry Wiggle',
      description: 'Your foodie pet can no longer hide its excitement about snacks.',
    },
    {
      unlockKey: 'foodie_snack_check',
      requiredLevel: 3,
      displayName: 'Snack Check',
      description: 'Your foodie pet now greets you before checking for snacks.',
    },
    {
      unlockKey: 'foodie_still_hungry',
      requiredLevel: 5,
      displayName: 'Still Hungry',
      description: 'Your foodie pet now quietly hopes for another bite after eating.',
    },
    {
      unlockKey: 'foodie_food_patrol',
      requiredLevel: 8,
      displayName: 'Food Patrol',
      description: 'Your foodie pet has started checking the feeding area for snacks.',
    },
    {
      unlockKey: 'foodie_sharing_time',
      requiredLevel: 12,
      displayName: 'Sharing Time',
      description: 'Your foodie pet now checks in with you before thinking about snacks.',
    },
  ],
}

// Returns every unlock defined for a temperament (empty array for an
// unknown/missing temperament), in ascending required-level order.
export function getUnlocksForTemperament(temperament) {
  return PERSONALITY_UNLOCKS[temperament] ?? []
}

// Returns the single unlock for a temperament at a specific affection level,
// or undefined if that temperament has no milestone at that level.
export function getUnlockForTemperamentAndLevel(temperament, level) {
  return getUnlocksForTemperament(temperament).find((unlock) => unlock.requiredLevel === level)
}

// Detects whether an affection change just crossed a personality-unlock
// milestone, using getAffectionLevelInfo (petAffectionLevels.js) as the sole
// level authority for levels above 1 — this module never re-derives level
// from affection itself. Returns the unlock definition that was newly
// crossed, or null when nothing was crossed (including staying within the
// same level, or a temperament with no unlock at the newly reached level).
//
// Level 1 is special-cased: getAffectionLevelInfo treats 0 lifetime
// affection as Level 1 (the floor every pet starts at), so there is no
// lower level for it to be "crossed" from via level comparison alone —
// previousLevel is always >= 1 already. Its milestone instead fires on the
// pet's very first ever affection gain: previous lifetime affection was
// still exactly 0 and this change just raised it above 0. A pet that had
// already gained any affection before this call is treated as having
// already passed that point, so it never retroactively fires (requirement:
// existing Level 1+ owners must not get the celebration on a later action).
//
// If multiple milestones were skipped over in one jump, the highest one
// crossed wins.
export function detectNewlyUnlockedPersonality({
  temperament,
  previousLifetimeAffection,
  nextLifetimeAffection,
}) {
  const unlocks = getUnlocksForTemperament(temperament)
  if (unlocks.length === 0) return null

  const previousAffection = Number.isFinite(previousLifetimeAffection)
    ? Math.max(0, Math.trunc(previousLifetimeAffection))
    : 0
  const nextAffection = Number.isFinite(nextLifetimeAffection)
    ? Math.max(0, Math.trunc(nextLifetimeAffection))
    : 0

  const previousLevel = getAffectionLevelInfo(previousAffection).level
  const nextLevel = getAffectionLevelInfo(nextAffection).level

  const crossedUnlocks = unlocks.filter((unlock) => {
    if (unlock.requiredLevel === 1) return previousAffection === 0 && nextAffection > 0
    return unlock.requiredLevel > previousLevel && unlock.requiredLevel <= nextLevel
  })
  if (crossedUnlocks.length === 0) return null

  return crossedUnlocks[crossedUnlocks.length - 1]
}
