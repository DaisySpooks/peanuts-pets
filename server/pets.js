// Minimal Supabase access via raw REST calls to PostgREST (no SDK
// dependency — same approach as discord.js talking to Discord's REST API
// directly). Server-side only: the service-role key never leaves this file.
const PET_TYPES = ['axolotl', 'betta', 'turtle']
const MAX_PET_NAME_LENGTH = 20
const DEFAULT_CARE_STATS = {
  hunger: 78,
  cleanliness: 86,
  happiness: 92,
}
const PET_ACTIONS = {
  feed: { statKey: 'hunger', delta: 12, timestampKey: 'last_feed_at' },
  clean: { statKey: 'cleanliness', delta: 18, timestampKey: 'last_clean_at' },
  play: { statKey: 'happiness', delta: 10, timestampKey: 'last_play_at' },
}

export function validatePetType(petType) {
  return typeof petType === 'string' && PET_TYPES.includes(petType)
}

export function validatePetName(name) {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_PET_NAME_LENGTH) return null
  return trimmed
}

function restHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: 'application/json',
    ...extra,
  }
}

function getPetsEndpointUrl(supabaseUrl) {
  const trimmed = String(supabaseUrl).replace(/\/+$/, '')
  const base = trimmed.endsWith('/rest/v1') ? trimmed : `${trimmed}/rest/v1`
  return `${base}/pets`
}

function normalizeCareValue(value, fallback) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback
}

function toPet(row) {
  if (!row) return null
  return {
    petType: row.pet_type,
    petName: row.pet_name,
    createdAt: row.created_at,
    hunger: normalizeCareValue(row.hunger, DEFAULT_CARE_STATS.hunger),
    cleanliness: normalizeCareValue(row.cleanliness, DEFAULT_CARE_STATS.cleanliness),
    happiness: normalizeCareValue(row.happiness, DEFAULT_CARE_STATS.happiness),
    lastFeedAt: row.last_feed_at ?? null,
    lastCleanAt: row.last_clean_at ?? null,
    lastPlayAt: row.last_play_at ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  }
}

export function validatePetAction(action) {
  return typeof action === 'string' && Object.hasOwn(PET_ACTIONS, action)
}

export async function getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId }) {
  const url = new URL(getPetsEndpointUrl(supabaseUrl))
  url.searchParams.set('discord_user_id', `eq.${discordUserId}`)
  url.searchParams.set(
    'select',
    'pet_type,pet_name,created_at,hunger,cleanliness,happiness,last_feed_at,last_clean_at,last_play_at,updated_at',
  )
  url.searchParams.set('limit', '1')

  const response = await fetch(url, { headers: restHeaders(serviceRoleKey) })
  if (!response.ok) {
    throw new Error(`supabase_pets_lookup_failed_${response.status}`)
  }

  const rows = await response.json()
  return toPet(rows[0])
}

// Check-then-insert, with a fallback re-fetch if a race loses the unique
// constraint on discord_user_id — either way, an existing pet is returned
// rather than creating a second one.
export async function createPetIfNotExists({ supabaseUrl, serviceRoleKey, discordUserId, petType, petName }) {
  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (existing) return existing

  const response = await fetch(getPetsEndpointUrl(supabaseUrl), {
    method: 'POST',
    headers: restHeaders(serviceRoleKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify([{ discord_user_id: discordUserId, pet_type: petType, pet_name: petName }]),
  })

  if (response.status === 409) {
    // Lost a race with a duplicate insert — the unique constraint on
    // discord_user_id did its job. Return whatever is actually there now.
    const current = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
    if (current) return current
    throw new Error('supabase_pets_conflict_without_existing_row')
  }

  if (!response.ok) {
    throw new Error(`supabase_pets_create_failed_${response.status}`)
  }

  const rows = await response.json()
  return toPet(rows[0])
}

export async function applyPetCareAction({ supabaseUrl, serviceRoleKey, discordUserId, action }) {
  const actionConfig = PET_ACTIONS[action]
  if (!actionConfig) {
    throw new Error('invalid_pet_action')
  }

  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (!existing) return null

  const now = new Date().toISOString()
  const nextValue = Math.min(100, existing[actionConfig.statKey] + actionConfig.delta)
  const payload = {
    [actionConfig.statKey]: nextValue,
    [actionConfig.timestampKey]: now,
    updated_at: now,
  }

  const url = new URL(getPetsEndpointUrl(supabaseUrl))
  url.searchParams.set('discord_user_id', `eq.${discordUserId}`)
  url.searchParams.set(
    'select',
    'pet_type,pet_name,created_at,hunger,cleanliness,happiness,last_feed_at,last_clean_at,last_play_at,updated_at',
  )

  const response = await fetch(url, {
    method: 'PATCH',
    headers: restHeaders(serviceRoleKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`supabase_pets_action_failed_${response.status}`)
  }

  const rows = await response.json()
  return toPet(rows[0])
}
