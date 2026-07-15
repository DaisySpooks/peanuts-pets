// Centralized lookup for which code-driven celebration animation (if any) a
// pet rig should play inside the personality-unlock celebration modal. Keyed
// by unlock key, then species — PersonalityUnlockCelebration.jsx requests an
// animation token from here instead of branching on species/unlockKey
// itself, so adding future unlocks/species never touches the modal.
//
// The Playful Level 1 "Happy Bounce", Curious Level 1 "Curious Peek", Gentle
// Level 1 "Happy Wave", Sleepy Level 1 "Sleepy Stretch", and Foodie Level 1
// "Hungry Wiggle" and Playful Level 12 "You're Here!" unlocks have animations (see
// server/petPersonalityUnlocks.js for the unlock definitions — this covers
// every Level 1 unlock). Every other unlock/species combination falls back
// to null — no special animation, same normal happy display as before this
// task.
//
// Playful Level 3 "Playtime Welcome", Curious Level 3 "Who's There?", Gentle
// Level 3 "Warm Hello", Sleepy Level 3 "Drowsy Greeting", Foodie Level 3
// "Snack Check", Foodie Level 5 "Still Hungry", Playful Level 5
// "Encore!", Curious Level 5 "What Was That?", Gentle Level 5 "Thank
// You", and Sleepy Level 5 "Cozy Time" are also wired here, ahead of their
// backend unlock definitions — these lookup entries are inert until
// server/petPersonalityUnlocks.js actually defines those milestones, since
// nothing can produce those unlockKeys before then. Frontend animation work
// for a milestone is intentionally decoupled from adding the milestone
// itself.
const HAPPY_BOUNCE_UNLOCK_KEY = 'playful_happy_bounce'
const CURIOUS_PEEK_UNLOCK_KEY = 'curious_curious_peek'
const GENTLE_WAVE_UNLOCK_KEY = 'gentle_happy_wave'
const SLEEPY_STRETCH_UNLOCK_KEY = 'sleepy_sleepy_stretch'
const HUNGRY_WIGGLE_UNLOCK_KEY = 'foodie_hungry_wiggle'
const PLAYTIME_WELCOME_UNLOCK_KEY = 'playful_playtime_welcome'
const ENCORE_UNLOCK_KEY = 'playful_encore'
const SHOW_OFF_UNLOCK_KEY = 'playful_show_off'
const WHOS_THERE_UNLOCK_KEY = 'curious_whos_there'
const WHAT_WAS_THAT_UNLOCK_KEY = 'curious_what_was_that'
const EXPLORER_UNLOCK_KEY = 'curious_explorer'
const WARM_HELLO_UNLOCK_KEY = 'gentle_warm_hello'
const THANK_YOU_UNLOCK_KEY = 'gentle_thank_you'
const PEACEFUL_MOMENT_UNLOCK_KEY = 'gentle_peaceful_moment'
const DROWSY_GREETING_UNLOCK_KEY = 'sleepy_drowsy_greeting'
const COZY_TIME_UNLOCK_KEY = 'sleepy_cozy_time'
const POWER_NAP_UNLOCK_KEY = 'sleepy_power_nap'
const SNACK_CHECK_UNLOCK_KEY = 'foodie_snack_check'
const STILL_HUNGRY_UNLOCK_KEY = 'foodie_still_hungry'
const FOOD_PATROL_UNLOCK_KEY = 'foodie_food_patrol'
const YOURE_HERE_UNLOCK_KEY = 'playful_youre_here'
const FOLLOW_ME_UNLOCK_KEY = 'curious_follow_me'
const HAPPY_TOGETHER_UNLOCK_KEY = 'gentle_happy_together'
const SLEEP_BESIDE_YOU_UNLOCK_KEY = 'sleepy_sleep_beside_you'
const SHARING_TIME_UNLOCK_KEY = 'foodie_sharing_time'

const UNLOCK_ANIMATIONS = {
  [HAPPY_BOUNCE_UNLOCK_KEY]: {
    axolotl: 'happy-bounce',
    betta: 'happy-bounce',
    turtle: 'happy-bounce',
  },
  [CURIOUS_PEEK_UNLOCK_KEY]: {
    axolotl: 'curious-peek',
    betta: 'curious-peek',
    turtle: 'curious-peek',
  },
  [GENTLE_WAVE_UNLOCK_KEY]: {
    axolotl: 'gentle-wave',
    betta: 'gentle-wave',
    turtle: 'gentle-wave',
  },
  [SLEEPY_STRETCH_UNLOCK_KEY]: {
    axolotl: 'sleepy-stretch',
    betta: 'sleepy-stretch',
    turtle: 'sleepy-stretch',
  },
  [HUNGRY_WIGGLE_UNLOCK_KEY]: {
    axolotl: 'hungry-wiggle',
    betta: 'hungry-wiggle',
    turtle: 'hungry-wiggle',
  },
  [PLAYTIME_WELCOME_UNLOCK_KEY]: {
    axolotl: 'playtime-welcome',
    betta: 'playtime-welcome',
    turtle: 'playtime-welcome',
  },
  [ENCORE_UNLOCK_KEY]: {
    axolotl: 'encore',
    betta: 'encore',
    turtle: 'encore',
  },
  [SHOW_OFF_UNLOCK_KEY]: {
    axolotl: 'show-off',
    betta: 'show-off',
    turtle: 'show-off',
  },
  [WHOS_THERE_UNLOCK_KEY]: {
    axolotl: 'curious-greeting',
    betta: 'curious-greeting',
    turtle: 'curious-greeting',
  },
  [WHAT_WAS_THAT_UNLOCK_KEY]: {
    axolotl: 'what-was-that',
    betta: 'what-was-that',
    turtle: 'what-was-that',
  },
  [EXPLORER_UNLOCK_KEY]: {
    axolotl: 'explorer',
    betta: 'explorer',
    turtle: 'explorer',
  },
  [WARM_HELLO_UNLOCK_KEY]: {
    axolotl: 'warm-hello',
    betta: 'warm-hello',
    turtle: 'warm-hello',
  },
  [THANK_YOU_UNLOCK_KEY]: {
    axolotl: 'thank-you',
    betta: 'thank-you',
    turtle: 'thank-you',
  },
  [PEACEFUL_MOMENT_UNLOCK_KEY]: {
    axolotl: 'peaceful-moment',
    betta: 'peaceful-moment',
    turtle: 'peaceful-moment',
  },
  [DROWSY_GREETING_UNLOCK_KEY]: {
    axolotl: 'drowsy-greeting',
    betta: 'drowsy-greeting',
    turtle: 'drowsy-greeting',
  },
  [COZY_TIME_UNLOCK_KEY]: {
    axolotl: 'cozy-time',
    betta: 'cozy-time',
    turtle: 'cozy-time',
  },
  [POWER_NAP_UNLOCK_KEY]: {
    axolotl: 'power-nap',
    betta: 'power-nap',
    turtle: 'power-nap',
  },
  [SNACK_CHECK_UNLOCK_KEY]: {
    axolotl: 'snack-check',
    betta: 'snack-check',
    turtle: 'snack-check',
  },
  [STILL_HUNGRY_UNLOCK_KEY]: {
    axolotl: 'still-hungry',
    betta: 'still-hungry',
    turtle: 'still-hungry',
  },
  [FOOD_PATROL_UNLOCK_KEY]: {
    axolotl: 'food-patrol',
    betta: 'food-patrol',
    turtle: 'food-patrol',
  },
  [YOURE_HERE_UNLOCK_KEY]: {
    axolotl: 'youre-here',
    betta: 'youre-here',
    turtle: 'youre-here',
  },
  [FOLLOW_ME_UNLOCK_KEY]: {
    axolotl: 'follow-me',
    betta: 'follow-me',
    turtle: 'follow-me',
  },
  [HAPPY_TOGETHER_UNLOCK_KEY]: {
    axolotl: 'happy-together',
    betta: 'happy-together',
    turtle: 'happy-together',
  },
  [SLEEP_BESIDE_YOU_UNLOCK_KEY]: {
    axolotl: 'sleep-beside-you',
    betta: 'sleep-beside-you',
    turtle: 'sleep-beside-you',
  },
  [SHARING_TIME_UNLOCK_KEY]: {
    axolotl: 'sharing-time',
    betta: 'sharing-time',
    turtle: 'sharing-time',
  },
}

// Returns the animation token the given species' rig should play for this
// unlock, or null when there's nothing special to play (unknown unlock,
// unknown species, or a known unlock this species has no animation for).
export function getUnlockCelebrationAnimation(unlockKey, species) {
  return UNLOCK_ANIMATIONS[unlockKey]?.[species] ?? null
}
