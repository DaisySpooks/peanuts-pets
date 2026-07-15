import assert from 'node:assert/strict'
import test from 'node:test'

import { cumulativeAffectionForLevel } from './petAffectionLevels.js'
import {
  applyPetCareAction,
  applyPetTreat,
  applyPettingInteraction,
  getPetByDiscordUserId,
  hasGivenTreatToday,
} from './pets.js'

const SUPABASE_URL = 'https://supabase.example'
const SERVICE_ROLE_KEY = 'service-role-key'

function createRow(overrides = {}) {
  return {
    pet_type: 'axolotl',
    pet_name: 'Mochi',
    created_at: '2026-07-12T12:00:00.000Z',
    hunger: 100,
    cleanliness: 100,
    happiness: 100,
    affection: 5,
    colour: 'pink',
    temperament: 'gentle',
    last_feed_at: null,
    last_clean_at: null,
    last_play_at: null,
    last_petted_at: null,
    updated_at: '2026-07-12T12:00:00.000Z',
    // Far in the future so getPetByDiscordUserId's decay pass is a no-op
    // for tests that aren't specifically exercising decay.
    last_decay_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

test.afterEach(() => {
  global.fetch = undefined
})

// --- Action restoration (Feed / Play) ---

test('foodie feed restores 30 hunger instead of 25', async () => {
  const calls = []
  global.fetch = async (input, init) => {
    calls.push({ url: new URL(input), init })
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'foodie', hunger: 50 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.hunger, 80)
    return createJsonResponse([createRow({ temperament: 'foodie', hunger: payload.hunger })])
  }

  const result = await applyPetCareAction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    action: 'feed',
  })

  assert.equal(result.hunger, 80)
})

test('non-foodie feed restores the normal 25 hunger', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'gentle', hunger: 50 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.hunger, 75)
    return createJsonResponse([createRow({ temperament: 'gentle', hunger: payload.hunger })])
  }

  const result = await applyPetCareAction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    action: 'feed',
  })

  assert.equal(result.hunger, 75)
})

test('playful play restores 30 happiness instead of 25', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'playful', happiness: 50 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.happiness, 80)
    return createJsonResponse([createRow({ temperament: 'playful', happiness: payload.happiness })])
  }

  const result = await applyPetCareAction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    action: 'play',
  })

  assert.equal(result.happiness, 80)
})

test('feed/play restoration still clamps to 100', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'foodie', hunger: 90 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.hunger, 100)
    return createJsonResponse([createRow({ temperament: 'foodie', hunger: payload.hunger })])
  }

  const result = await applyPetCareAction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    action: 'feed',
  })

  assert.equal(result.hunger, 100)
})

test('clean restoration is unaffected by any temperament', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'foodie', cleanliness: 50 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.cleanliness, 75)
    return createJsonResponse([createRow({ temperament: 'foodie', cleanliness: payload.cleanliness })])
  }

  const result = await applyPetCareAction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    action: 'clean',
  })

  assert.equal(result.cleanliness, 75)
})

test('invalid stored temperament falls back to normal restoration amounts', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'grumpy', hunger: 50 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.hunger, 75)
    return createJsonResponse([createRow({ temperament: 'grumpy', hunger: payload.hunger })])
  }

  const result = await applyPetCareAction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    action: 'feed',
  })

  assert.equal(result.hunger, 75)
})

// --- Passive decay ---

async function runDecay(temperament) {
  let patchPayload = null
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament,
        hunger: 100,
        cleanliness: 100,
        happiness: 100,
        last_decay_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      })])
    }
    patchPayload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament,
      hunger: patchPayload.hunger,
      cleanliness: patchPayload.cleanliness,
      happiness: patchPayload.happiness,
      last_decay_at: patchPayload.last_decay_at,
    })])
  }

  await getPetByDiscordUserId({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  return patchPayload
}

test('playful decays happiness 10% faster (33 instead of 30 over 1 day)', async () => {
  const payload = await runDecay('playful')
  assert.ok(Math.abs(payload.happiness - 67) < 0.01)
  assert.ok(Math.abs(payload.hunger - 65) < 0.01)
})

test('gentle decays happiness 10% slower (27 instead of 30 over 1 day)', async () => {
  const payload = await runDecay('gentle')
  assert.ok(Math.abs(payload.happiness - 73) < 0.01)
  assert.ok(Math.abs(payload.hunger - 65) < 0.01)
})

test('sleepy decays happiness 15% slower (25.5 instead of 30 over 1 day)', async () => {
  const payload = await runDecay('sleepy')
  assert.ok(Math.abs(payload.happiness - 74.5) < 0.01)
})

test('foodie decays hunger 10% faster (38.5 instead of 35 over 1 day)', async () => {
  const payload = await runDecay('foodie')
  assert.ok(Math.abs(payload.hunger - 61.5) < 0.01)
  assert.ok(Math.abs(payload.happiness - 70) < 0.01)
})

test('curious has no decay modifier', async () => {
  const payload = await runDecay('curious')
  assert.ok(Math.abs(payload.hunger - 65) < 0.01)
  assert.ok(Math.abs(payload.happiness - 70) < 0.01)
})

test('missing/invalid temperament decays at the neutral baseline', async () => {
  const payloadNull = await runDecay(null)
  assert.ok(Math.abs(payloadNull.hunger - 65) < 0.01)
  assert.ok(Math.abs(payloadNull.happiness - 70) < 0.01)

  const payloadInvalid = await runDecay('grumpy')
  assert.ok(Math.abs(payloadInvalid.hunger - 65) < 0.01)
  assert.ok(Math.abs(payloadInvalid.happiness - 70) < 0.01)
})

test('cleanliness decay is never modified by temperament', async () => {
  for (const temperament of ['playful', 'curious', 'gentle', 'sleepy', 'foodie', null]) {
    const payload = await runDecay(temperament)
    assert.ok(Math.abs(payload.cleanliness - 75) < 0.01)
  }
})

// --- Petting / Affection ---

test('curious grants +1 additional affection on successful petting', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'curious', affection: 5 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.affection, 7)
    return createJsonResponse([createRow({ temperament: 'curious', affection: payload.affection })])
  }

  const result = await applyPettingInteraction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.affection, 7)
})

test('non-curious petting grants the normal +1 affection', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'sleepy', affection: 5 })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.affection, 6)
    return createJsonResponse([createRow({ temperament: 'sleepy', affection: payload.affection })])
  }

  const result = await applyPettingInteraction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.affection, 6)
})

// --- Personality unlock persistence ---

test('a pet gaining its first-ever affection persists the Level 1 personality unlock', async () => {
  const unlockInserts = []
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockInserts.push(JSON.parse(init.body))
      return createJsonResponse([{
        unlock_id: 'unlock-1',
        discord_user_id: 'user-1',
        unlock_key: 'playful_happy_bounce',
        temperament: 'playful',
        earned_at: '2026-07-14T12:00:00.000Z',
      }])
    }
    if (!init || init.method === undefined) {
      // lifetime_affection omitted -> toPet defaults it to 0 (never petted before).
      return createJsonResponse([createRow({ temperament: 'playful', affection: 0 })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'playful',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const result = await applyPettingInteraction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.newlyUnlockedPersonality?.unlockKey, 'playful_happy_bounce')
  assert.equal(unlockInserts.length, 1)
  assert.deepEqual(unlockInserts[0], [{
    discord_user_id: 'user-1',
    unlock_key: 'playful_happy_bounce',
    temperament: 'playful',
  }])
})

test('crossing from below Level 3 into Level 3 persists the correct unlock once and returns it', async () => {
  const level3At = cumulativeAffectionForLevel(3)
  const unlockInserts = []
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockInserts.push(JSON.parse(init.body))
      return createJsonResponse([{
        unlock_id: 'unlock-l3',
        discord_user_id: 'user-1',
        unlock_key: 'foodie_snack_check',
        temperament: 'foodie',
        earned_at: '2026-07-14T12:00:00.000Z',
      }])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'foodie',
        affection: level3At - 1,
        lifetime_affection: level3At - 1,
      })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'foodie',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const result = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.newlyUnlockedPersonality?.unlockKey, 'foodie_snack_check')
  assert.equal(unlockInserts.length, 1)
  assert.deepEqual(unlockInserts[0], [{
    discord_user_id: 'user-1',
    unlock_key: 'foodie_snack_check',
    temperament: 'foodie',
  }])
})

test('crossing from below Level 5 into Level 5 persists the correct unlock once and returns it', async () => {
  const level5At = cumulativeAffectionForLevel(5)
  const unlockInserts = []
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockInserts.push(JSON.parse(init.body))
      return createJsonResponse([{
        unlock_id: 'unlock-l5',
        discord_user_id: 'user-1',
        unlock_key: 'sleepy_cozy_time',
        temperament: 'sleepy',
        earned_at: '2026-07-14T12:00:00.000Z',
      }])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'sleepy',
        affection: level5At - 1,
        lifetime_affection: level5At - 1,
      })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'sleepy',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const result = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.newlyUnlockedPersonality?.unlockKey, 'sleepy_cozy_time')
  assert.equal(unlockInserts.length, 1)
  assert.deepEqual(unlockInserts[0], [{
    discord_user_id: 'user-1',
    unlock_key: 'sleepy_cozy_time',
    temperament: 'sleepy',
  }])
})

test('petting that stays within Level 1 never calls the personality-unlocks endpoint', async () => {
  const unlockInserts = []
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockInserts.push(JSON.parse(init.body))
      return createJsonResponse([])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'playful', affection: 5, lifetime_affection: 5 })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'playful',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const result = await applyPettingInteraction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.newlyUnlockedPersonality, null)
  assert.equal(unlockInserts.length, 0)
})

test('remaining within the same level does not create a Level 3 or Level 5 unlock', async () => {
  const level3At = cumulativeAffectionForLevel(3)
  const unlockInserts = []
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockInserts.push(JSON.parse(init.body))
      return createJsonResponse([])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'gentle',
        affection: level3At,
        lifetime_affection: level3At,
      })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'gentle',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const result = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.newlyUnlockedPersonality, null)
  assert.equal(unlockInserts.length, 0)
})

test('a retried unlock insert for the same pet is ignored as a duplicate, not recorded twice', async () => {
  const unlockInserts = []
  let unlockCallCount = 0
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockCallCount += 1
      unlockInserts.push(JSON.parse(init.body))
      // First call: the row is newly inserted. Second call (the retry):
      // the unique index on (discord_user_id, unlock_key) means Postgres
      // silently ignores the duplicate and PostgREST returns an empty array.
      if (unlockCallCount === 1) {
        return createJsonResponse([{
          unlock_id: 'unlock-1',
          discord_user_id: 'user-1',
          unlock_key: 'playful_happy_bounce',
          temperament: 'playful',
          earned_at: '2026-07-14T12:00:00.000Z',
        }])
      }
      return createJsonResponse([])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({ temperament: 'playful', affection: 0 })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'playful',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const first = await applyPettingInteraction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })
  const retried = await applyPettingInteraction({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(first.newlyUnlockedPersonality?.unlockKey, 'playful_happy_bounce')
  assert.equal(retried.newlyUnlockedPersonality?.unlockKey, 'playful_happy_bounce')
  assert.equal(unlockInserts.length, 2)
  assert.deepEqual(unlockInserts[0], unlockInserts[1])
})

test('a retried Level 3 unlock insert remains idempotent for the same unlock key', async () => {
  const level3At = cumulativeAffectionForLevel(3)
  const unlockInserts = []
  let unlockCallCount = 0
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockCallCount += 1
      unlockInserts.push(JSON.parse(init.body))
      if (unlockCallCount === 1) {
        return createJsonResponse([{
          unlock_id: 'unlock-l3',
          discord_user_id: 'user-1',
          unlock_key: 'foodie_snack_check',
          temperament: 'foodie',
          earned_at: '2026-07-14T12:00:00.000Z',
        }])
      }
      return createJsonResponse([])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'foodie',
        affection: level3At - 1,
        lifetime_affection: level3At - 1,
      })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'foodie',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const first = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })
  const retried = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(first.newlyUnlockedPersonality?.unlockKey, 'foodie_snack_check')
  assert.equal(retried.newlyUnlockedPersonality?.unlockKey, 'foodie_snack_check')
  assert.equal(unlockInserts.length, 2)
  assert.deepEqual(unlockInserts[0], unlockInserts[1])
})

test('a retried Level 5 unlock insert remains idempotent for the same unlock key', async () => {
  const level5At = cumulativeAffectionForLevel(5)
  const unlockInserts = []
  let unlockCallCount = 0
  global.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/pet_personality_unlocks') {
      unlockCallCount += 1
      unlockInserts.push(JSON.parse(init.body))
      if (unlockCallCount === 1) {
        return createJsonResponse([{
          unlock_id: 'unlock-l5',
          discord_user_id: 'user-1',
          unlock_key: 'sleepy_cozy_time',
          temperament: 'sleepy',
          earned_at: '2026-07-14T12:00:00.000Z',
        }])
      }
      return createJsonResponse([])
    }
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'sleepy',
        affection: level5At - 1,
        lifetime_affection: level5At - 1,
      })])
    }
    const payload = JSON.parse(init.body)
    return createJsonResponse([createRow({
      temperament: 'sleepy',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
    })])
  }

  const first = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })
  const retried = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(first.newlyUnlockedPersonality?.unlockKey, 'sleepy_cozy_time')
  assert.equal(retried.newlyUnlockedPersonality?.unlockKey, 'sleepy_cozy_time')
  assert.equal(unlockInserts.length, 2)
  assert.deepEqual(unlockInserts[0], unlockInserts[1])
})

// --- Treat / Lifetime Affection ---

test('hasGivenTreatToday is false when there is no prior treat', () => {
  assert.equal(hasGivenTreatToday(null), false)
})

test('hasGivenTreatToday is true for a treat given earlier the same UTC day', () => {
  const now = Date.parse('2026-07-13T18:00:00.000Z')
  assert.equal(hasGivenTreatToday('2026-07-13T02:00:00.000Z', now), true)
})

test('hasGivenTreatToday is false once the UTC calendar day has rolled over', () => {
  const now = Date.parse('2026-07-14T00:00:01.000Z')
  assert.equal(hasGivenTreatToday('2026-07-13T23:59:59.000Z', now), false)
})

test('applyPetTreat grants a flat +1 to both affection and lifetime affection, independent of temperament', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      // Curious normally grants a +1 petting bonus (see
      // getPettingAffectionBonus) — applyPetTreat must never look that up.
      return createJsonResponse([createRow({
        temperament: 'curious',
        affection: 5,
        lifetime_affection: 12,
        last_treat_at: null,
      })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.affection, 6)
    assert.equal(payload.lifetime_affection, 13)
    assert.ok(typeof payload.last_treat_at === 'string')
    return createJsonResponse([createRow({
      temperament: 'curious',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
      last_treat_at: payload.last_treat_at,
    })])
  }

  const result = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.affection, 6)
  assert.equal(result.lifetimeAffection, 13)
})

test('applyPetTreat with a non-bonus temperament still grants exactly +1 to both fields', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'sleepy',
        affection: 5,
        lifetime_affection: 12,
        last_treat_at: null,
      })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.affection, 6)
    assert.equal(payload.lifetime_affection, 13)
    return createJsonResponse([createRow({
      temperament: 'sleepy',
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
      last_treat_at: payload.last_treat_at,
    })])
  }

  const result = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.affection, 6)
  assert.equal(result.lifetimeAffection, 13)
})

test('applyPetTreat never touches hunger or happiness', async () => {
  global.fetch = async (input, init) => {
    if (!init || init.method === undefined) {
      return createJsonResponse([createRow({
        temperament: 'foodie',
        hunger: 60,
        happiness: 70,
        affection: 5,
        lifetime_affection: 12,
        last_treat_at: null,
      })])
    }
    const payload = JSON.parse(init.body)
    assert.equal(payload.hunger, undefined)
    assert.equal(payload.happiness, undefined)
    return createJsonResponse([createRow({
      temperament: 'foodie',
      hunger: 60,
      happiness: 70,
      affection: payload.affection,
      lifetime_affection: payload.lifetime_affection,
      last_treat_at: payload.last_treat_at,
    })])
  }

  const result = await applyPetTreat({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
  })

  assert.equal(result.hunger, 60)
  assert.equal(result.happiness, 70)
})

test('applyPetTreat rejects a second treat the same UTC day', async () => {
  global.fetch = async () => createJsonResponse([createRow({
    lifetime_affection: 12,
    last_treat_at: new Date().toISOString(),
  })])

  await assert.rejects(
    applyPetTreat({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      discordUserId: 'user-1',
    }),
    (error) => {
      assert.equal(error.code, 'treat_already_given_today')
      return true
    },
  )
})
