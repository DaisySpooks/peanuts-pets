// Frontend boundary for the Pet Thoughts pool. The 25 thought texts live
// only in server/petThoughts.js (server/ never ships to the frontend
// bundle — see src/petColourOptions.js) — this fetches them instead of
// duplicating that copy here.
export async function getPetThoughts(temperament) {
  try {
    const response = await fetch(`/api/pet-thoughts/${encodeURIComponent(temperament)}`)
    if (!response.ok) return []
    const data = await response.json().catch(() => ({}))
    return Array.isArray(data.thoughts) ? data.thoughts : []
  } catch {
    return []
  }
}

// Same shape as getPetThoughts, but for the separate once-per-day greeting
// pool (see server/petThoughts.js).
export async function getPetGreetings(temperament) {
  try {
    const response = await fetch(`/api/pet-greetings/${encodeURIComponent(temperament)}`)
    if (!response.ok) return []
    const data = await response.json().catch(() => ({}))
    return Array.isArray(data.greetings) ? data.greetings : []
  } catch {
    return []
  }
}
