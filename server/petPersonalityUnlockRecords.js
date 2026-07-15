// Persistence for earned personality unlocks (see petPersonalityUnlocks.js
// for the unlock definitions themselves — this module only records that one
// was earned). Same raw-REST-to-PostgREST approach as pets.js, called with
// the same supabaseUrl/serviceRoleKey already in scope at the call site
// rather than re-reading env vars, so it doesn't duplicate config lookup.
function restHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: 'application/json',
    ...extra,
  }
}

function getPetPersonalityUnlocksEndpointUrl(supabaseUrl) {
  const trimmed = String(supabaseUrl).replace(/\/+$/, '')
  const base = trimmed.endsWith('/rest/v1') ? trimmed : `${trimmed}/rest/v1`
  return `${base}/pet_personality_unlocks`
}

function toPetPersonalityUnlockRecord(row) {
  if (!row) return null
  return {
    unlockId: row.unlock_id,
    discordUserId: row.discord_user_id,
    unlockKey: row.unlock_key,
    temperament: row.temperament,
    earnedAt: row.earned_at,
  }
}

// Idempotently records that a personality unlock was earned. A unique index
// on (discord_user_id, unlock_key) plus `Prefer: resolution=ignore-
// duplicates` means a retried/duplicate call is a silent no-op — the
// existing row is left untouched and no error is raised — rather than a 409
// or a second row, so no check-then-insert race handling is needed here.
//
// Returns the inserted record, or null when the unlock was already earned
// (the insert was ignored as a duplicate).
export async function recordPersonalityUnlock({
  supabaseUrl,
  serviceRoleKey,
  discordUserId,
  unlockKey,
  temperament,
}) {
  const response = await fetch(getPetPersonalityUnlocksEndpointUrl(supabaseUrl), {
    method: 'POST',
    headers: restHeaders(serviceRoleKey, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    }),
    body: JSON.stringify([{
      discord_user_id: discordUserId,
      unlock_key: unlockKey,
      temperament,
    }]),
  })

  if (!response.ok) {
    throw new Error(`supabase_pet_personality_unlocks_insert_failed_${response.status}`)
  }

  const rows = await response.json()
  return toPetPersonalityUnlockRecord(rows[0] ?? null)
}

// Returns the earned unlock keys for one authenticated pet owner, in stable
// earned order, with no database metadata exposed to callers. Empty array
// means no personality unlocks have been earned yet.
export async function listEarnedPersonalityUnlockKeys({
  supabaseUrl,
  serviceRoleKey,
  discordUserId,
}) {
  const url = new URL(getPetPersonalityUnlocksEndpointUrl(supabaseUrl))
  url.searchParams.set('discord_user_id', `eq.${discordUserId}`)
  url.searchParams.set('select', 'unlock_key')
  url.searchParams.set('order', 'earned_at.asc')

  const response = await fetch(url, {
    headers: restHeaders(serviceRoleKey),
  })

  if (!response.ok) {
    throw new Error(`supabase_pet_personality_unlocks_lookup_failed_${response.status}`)
  }

  const rows = await response.json()
  return rows
    .map((row) => row?.unlock_key)
    .filter((unlockKey) => typeof unlockKey === 'string')
}
