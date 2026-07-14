// Single source of truth for Pet Thoughts copy, grouped by temperament.
// Phase 1 only: this helper just picks a random thought for a temperament —
// no persistence, timers, generation intervals, or UI hang off it here.
const TEMPERAMENT_THOUGHTS = {
  playful: [
    { key: 'playful_ran_around', text: "I ran around for no reason... it was amazing!" },
    { key: 'playful_chased_tail', text: "I chased my own tail today. I almost caught it!" },
    { key: 'playful_fun_here', text: "Everything is more fun when you're here!" },
    { key: 'playful_lost_stick', text: "I found the perfect stick... then lost it." },
    { key: 'playful_play_day', text: "I think today was made for playing." },
  ],
  curious: [
    { key: 'curious_sun', text: "I wonder where the sun goes at night..." },
    { key: 'curious_rock', text: "I found a funny-looking rock today." },
    { key: 'curious_bugs', text: "Do you think bugs have best friends?" },
    { key: 'curious_clouds', text: "I tried to count the clouds but lost track." },
    { key: 'curious_explore', text: "There are so many things I still want to explore." },
  ],
  gentle: [
    { key: 'gentle_day', text: "I hope you're having a nice day." },
    { key: 'gentle_flower', text: "I saw a pretty flower and thought of you." },
    { key: 'gentle_peaceful', text: "It's peaceful here today." },
    { key: 'gentle_quiet', text: "I like spending quiet time together." },
    { key: 'gentle_kindness', text: "I think kindness makes everything a little brighter." },
  ],
  sleepy: [
    { key: 'sleepy_nap', text: "I had the coziest nap." },
    { key: 'sleepy_five_minutes', text: "Just five more minutes..." },
    { key: 'sleepy_dream', text: "I dreamed we went on an adventure." },
    { key: 'sleepy_curl_up', text: "It's a perfect day for curling up." },
    { key: 'sleepy_tired', text: "I feel extra sleepy today." },
  ],
  foodie: [
    { key: 'foodie_hungry', text: "I think I'm hungry... again." },
    { key: 'foodie_snack', text: "I wonder what today's snack will be." },
    { key: 'foodie_smells', text: "Everything smells delicious today." },
    { key: 'foodie_after_play', text: "Food tastes even better after playing!" },
    { key: 'foodie_treat', text: "I could definitely eat one more treat." },
  ],
}

// Returns a random thought ({ key, text }) for a temperament, or null when
// the temperament has no thought pool (unknown/missing temperament).
export function getRandomThoughtForTemperament(temperament, randomFn = Math.random) {
  const thoughts = TEMPERAMENT_THOUGHTS[temperament]
  if (!thoughts || thoughts.length === 0) return null

  const index = Math.min(Math.floor(randomFn() * thoughts.length), thoughts.length - 1)
  return thoughts[index]
}

// Returns the full thought pool for a temperament (a copy, so callers can't
// mutate the shared table), or null for an unknown temperament. Used to hand
// the client the pool for its own random idle-thought selection, instead of
// duplicating this copy in the frontend bundle.
export function getThoughtsForTemperament(temperament) {
  const thoughts = TEMPERAMENT_THOUGHTS[temperament]
  if (!thoughts) return null
  return thoughts.map((thought) => ({ ...thought }))
}

// Daily Greeting Thoughts (Phase: first-visit-of-day greeting). A pool
// completely separate from TEMPERAMENT_THOUGHTS above — greetings are only
// ever shown once per calendar day, right when the habitat loads, never as
// part of the idle-thought rotation.
const TEMPERAMENT_GREETINGS = {
  playful: [
    { key: 'playful_waiting', text: "You're back! I was waiting for you!" },
    { key: 'playful_fun', text: "There you are! Ready to have some fun?" },
    { key: 'playful_energy', text: "Hi! I saved all my energy for you!" },
    { key: 'playful_play', text: "You came back! Let's play!" },
    { key: 'playful_glad', text: "I'm so glad you're here!" },
  ],
  curious: [
    { key: 'curious_tell', text: "You're back! I have so much to tell you." },
    { key: 'curious_visit', text: "There you are! I was wondering when you'd visit." },
    { key: 'curious_day', text: "Hi! Did anything interesting happen while you were away?" },
    { key: 'curious_question', text: "You came back! I have a question for you." },
    { key: 'curious_thinking', text: "I'm glad you're here. I've been thinking." },
  ],
  gentle: [
    { key: 'gentle_happy', text: "Welcome back. I'm happy to see you." },
    { key: 'gentle_missed', text: "There you are. I missed having you here." },
    { key: 'gentle_visit', text: "Hi again. It feels nicer when you visit." },
    { key: 'gentle_glad', text: "I'm so glad you came back." },
    { key: 'gentle_kind', text: "Welcome back. I hope your day has been kind." },
  ],
  sleepy: [
    { key: 'sleepy_hi', text: "Oh... you're back. Hi." },
    { key: 'sleepy_waking', text: "There you are. I was just waking up." },
    { key: 'sleepy_missed', text: "Welcome back... I missed you a little." },
    { key: 'sleepy_visit', text: "Hi. I'm glad you came to visit." },
    { key: 'sleepy_cozy', text: "You're back. I saved you a cozy spot." },
  ],
  foodie: [
    { key: 'foodie_snacks', text: "You're back! Did you bring snacks?" },
    { key: 'foodie_hoping', text: "There you are! I was hoping you'd visit." },
    { key: 'foodie_food', text: "Hi! I'm glad you came back... and maybe brought food." },
    { key: 'foodie_hungry', text: "Welcome back! I was getting hungry without you." },
    { key: 'foodie_treat', text: "You came back! That calls for a treat." },
  ],
}

// Returns a random greeting ({ key, text }) for a temperament, or null when
// the temperament has no greeting pool (unknown/missing temperament).
export function getRandomGreetingForTemperament(temperament, randomFn = Math.random) {
  const greetings = TEMPERAMENT_GREETINGS[temperament]
  if (!greetings || greetings.length === 0) return null

  const index = Math.min(Math.floor(randomFn() * greetings.length), greetings.length - 1)
  return greetings[index]
}

// Returns the full greeting pool for a temperament (a copy, so callers can't
// mutate the shared table), or null for an unknown temperament. Same
// full-pool-to-client pattern as getThoughtsForTemperament.
export function getGreetingsForTemperament(temperament) {
  const greetings = TEMPERAMENT_GREETINGS[temperament]
  if (!greetings) return null
  return greetings.map((greeting) => ({ ...greeting }))
}
