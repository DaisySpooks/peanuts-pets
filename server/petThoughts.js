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
