// Starter Treat reaction bubble copy. Purely decorative client-side
// flourish shown once after a successful treat (see useHabitatScreen's
// treat handling) — no temperament weighting, no persistence, same
// "just pick one at random" shape as getRandomThoughtForTemperament in
// server/petThoughts.js, but static/local since Treat reactions aren't
// temperament-specific.
const TREAT_REACTIONS = [
  'That was delicious!',
  "You're the best!",
  'Can I have another tomorrow?',
  'That made my day!',
  'Thank you for the treat!',
]

export function getRandomTreatReaction(randomFn = Math.random) {
  const index = Math.min(Math.floor(randomFn() * TREAT_REACTIONS.length), TREAT_REACTIONS.length - 1)
  return TREAT_REACTIONS[index]
}
