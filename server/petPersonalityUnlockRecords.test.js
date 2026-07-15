import assert from 'node:assert/strict'
import test from 'node:test'

import { recordPersonalityUnlock } from './petPersonalityUnlockRecords.js'

const SUPABASE_URL = 'https://supabase.example'
const SERVICE_ROLE_KEY = 'service-role-key'

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

test.afterEach(() => {
  global.fetch = undefined
})

test('first unlock insert persists the row and returns it', async () => {
  global.fetch = async (input, init) => {
    assert.equal(input, 'https://supabase.example/rest/v1/pet_personality_unlocks')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.apikey, 'service-role-key')
    assert.equal(init.headers.Authorization, 'Bearer service-role-key')
    assert.equal(init.headers.Prefer, 'resolution=ignore-duplicates,return=representation')
    const payload = JSON.parse(init.body)
    assert.deepEqual(payload, [{
      discord_user_id: 'user-1',
      unlock_key: 'playful_happy_bounce',
      temperament: 'playful',
    }])
    return createJsonResponse([{
      unlock_id: 'unlock-1',
      discord_user_id: 'user-1',
      unlock_key: 'playful_happy_bounce',
      temperament: 'playful',
      earned_at: '2026-07-14T12:00:00.000Z',
    }])
  }

  const result = await recordPersonalityUnlock({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    unlockKey: 'playful_happy_bounce',
    temperament: 'playful',
  })

  assert.equal(result.unlockKey, 'playful_happy_bounce')
  assert.equal(result.discordUserId, 'user-1')
  assert.equal(result.temperament, 'playful')
})

test('duplicate insert is ignored by Postgres and returns null, not an error', async () => {
  // With `resolution=ignore-duplicates`, PostgREST returns 201 with an empty
  // array when the row already exists (unique index on
  // discord_user_id + unlock_key) — no 409, no second row.
  global.fetch = async () => createJsonResponse([], { status: 201 })

  const result = await recordPersonalityUnlock({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    discordUserId: 'user-1',
    unlockKey: 'playful_happy_bounce',
    temperament: 'playful',
  })

  assert.equal(result, null)
})

test('a failed insert throws rather than silently succeeding', async () => {
  global.fetch = async () => createJsonResponse({ message: 'boom' }, { status: 500 })

  await assert.rejects(
    recordPersonalityUnlock({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      discordUserId: 'user-1',
      unlockKey: 'playful_happy_bounce',
      temperament: 'playful',
    }),
    /supabase_pet_personality_unlocks_insert_failed_500/,
  )
})
