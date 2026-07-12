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
const LOW_CARE_STATS = {
  hunger: 10,
  cleanliness: 10,
  happiness: 10,
}
const HIGH_CARE_STATS = {
  hunger: 95,
  cleanliness: 95,
  happiness: 95,
}
const DAY_MS = 24 * 60 * 60 * 1000
// Passive decay, independent of the feed/clean/play cooldown timestamps and
// of `updated_at` — based purely on elapsed wall-clock time since the
// dedicated `last_decay_at` clock.
const STAT_DECAY_PER_DAY = {
  hunger: 35,
  cleanliness: 25,
  happiness: 30,
}
const MAX_SIMULATED_ELAPSED_HOURS = 24 * 365
const PETTING_COOLDOWN_MS = 12 * 60 * 60 * 1000
const PET_ACTIONS = {
  feed: { statKey: 'hunger', delta: 25, columnTimestampKey: 'last_feed_at', petTimestampKey: 'lastFeedAt', cooldownMs: 2 * 60 * 60 * 1000 },
  clean: { statKey: 'cleanliness', delta: 25, columnTimestampKey: 'last_clean_at', petTimestampKey: 'lastCleanAt', cooldownMs: 3 * 60 * 60 * 1000 },
  play: { statKey: 'happiness', delta: 25, columnTimestampKey: 'last_play_at', petTimestampKey: 'lastPlayAt', cooldownMs: 4 * 60 * 60 * 1000 },
}
const BASE_PET_SELECT_WITH_PETTING =
  'pet_type,pet_name,created_at,hunger,cleanliness,happiness,last_feed_at,last_clean_at,last_play_at,last_petted_at,updated_at,last_decay_at'
const BASE_PET_SELECT_LEGACY =
  'pet_type,pet_name,created_at,hunger,cleanliness,happiness,last_feed_at,last_clean_at,last_play_at,updated_at,last_decay_at'
const ADMIN_PET_SELECT_WITH_PETTING = `discord_user_id,${BASE_PET_SELECT_WITH_PETTING}`
const ADMIN_PET_SELECT_LEGACY = `discord_user_id,${BASE_PET_SELECT_LEGACY}`
let hasLastPettedAtColumn = true

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

function getPetSelectClause({ includeDiscordUserId = false } = {}) {
  if (includeDiscordUserId) {
    return hasLastPettedAtColumn ? ADMIN_PET_SELECT_WITH_PETTING : ADMIN_PET_SELECT_LEGACY
  }
  return hasLastPettedAtColumn ? BASE_PET_SELECT_WITH_PETTING : BASE_PET_SELECT_LEGACY
}

function buildPetsUrl({ supabaseUrl, discordUserId, select, limit, orderByCreatedAtDesc = false }) {
  const url = new URL(getPetsEndpointUrl(supabaseUrl))

  if (discordUserId) {
    url.searchParams.set('discord_user_id', `eq.${discordUserId}`)
  }
  if (select) {
    url.searchParams.set('select', select)
  }
  if (Number.isFinite(limit) && limit > 0) {
    url.searchParams.set('limit', String(limit))
  }
  if (orderByCreatedAtDesc) {
    url.searchParams.set('order', 'created_at.desc')
  }

  return url
}

// Stat columns are numeric and may come back from PostgREST as a JSON
// number or a numeric-looking string — coerce before clamping. Fractional
// precision is kept here deliberately; rounding only happens when a pet is
// formatted for the frontend (see toDisplayPet).
function normalizeCareValue(value, fallback) {
  const numericValue = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(numericValue) ? Math.max(0, Math.min(100, numericValue)) : fallback
}

function toPet(row, { includeDiscordUserId = false } = {}) {
  if (!row) return null
  const pet = {
    petType: row.pet_type,
    petName: row.pet_name,
    createdAt: row.created_at,
    hunger: normalizeCareValue(row.hunger, DEFAULT_CARE_STATS.hunger),
    cleanliness: normalizeCareValue(row.cleanliness, DEFAULT_CARE_STATS.cleanliness),
    happiness: normalizeCareValue(row.happiness, DEFAULT_CARE_STATS.happiness),
    lastFeedAt: row.last_feed_at ?? null,
    lastCleanAt: row.last_clean_at ?? null,
    lastPlayAt: row.last_play_at ?? null,
    lastPettedAt: row.last_petted_at ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    lastDecayAt: row.last_decay_at ?? row.updated_at ?? row.created_at ?? null,
  }

  if (includeDiscordUserId) {
    pet.discordUserId = row.discord_user_id
  }

  return pet
}

async function isMissingLastPettedAtColumnResponse(response) {
  if (response.status !== 400 || !hasLastPettedAtColumn) return false

  const bodyText = await response.text()
  if (!bodyText.includes('last_petted_at')) return false

  hasLastPettedAtColumn = false
  return true
}

// Rounds the fractional stat values for client display only — the stored
// precision is never touched. Call this at the API response boundary, not
// on values used for further decay/action math.
export function toDisplayPet(pet) {
  if (!pet) return pet
  return {
    ...pet,
    hunger: Math.round(pet.hunger),
    cleanliness: Math.round(pet.cleanliness),
    happiness: Math.round(pet.happiness),
  }
}

export function validatePetAction(action) {
  return typeof action === 'string' && Object.hasOwn(PET_ACTIONS, action)
}

function getPettingCooldownRemainingMs(lastPettedAt, nowMs = Date.now()) {
  if (!lastPettedAt) return 0
  const lastPettedMs = new Date(lastPettedAt).getTime()
  if (!Number.isFinite(lastPettedMs)) return 0
  return Math.max(0, PETTING_COOLDOWN_MS - (nowMs - lastPettedMs))
}

function getCareStatsPreset(preset) {
  if (preset === 'default') return DEFAULT_CARE_STATS
  if (preset === 'low') return LOW_CARE_STATS
  if (preset === 'high') return HIGH_CARE_STATS
  return null
}

async function patchPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId, payload }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const url = buildPetsUrl({
      supabaseUrl,
      discordUserId,
      select: getPetSelectClause(),
    })

    const response = await fetch(url, {
      method: 'PATCH',
      headers: restHeaders(serviceRoleKey, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      if (await isMissingLastPettedAtColumnResponse(response)) {
        continue
      }
      throw new Error(`supabase_pets_patch_failed_${response.status}`)
    }

    const rows = await response.json()
    return toPet(rows[0])
  }

  throw new Error('supabase_pets_patch_failed_400')
}

// Computes decay from elapsed real time since `last_decay_at` only — never
// from `updated_at` (which care actions and admin edits legitimately touch
// for unrelated reasons, and would otherwise postpone decay of unrelated
// stats) and never from last_feed_at/last_clean_at/last_play_at, which stay
// dedicated to cooldowns. Values stay fractional here; clamping is the only
// adjustment. Rounding only happens at display time (see toDisplayPet).
function computeDecayedStats(pet, nowMs) {
  const lastDecayMs = new Date(pet.lastDecayAt).getTime()
  if (!Number.isFinite(lastDecayMs)) return null

  const elapsedMs = nowMs - lastDecayMs
  if (elapsedMs <= 0) return null

  const clamp = (value) => Math.max(0, Math.min(100, value))
  return {
    hunger: clamp(pet.hunger - (STAT_DECAY_PER_DAY.hunger * elapsedMs) / DAY_MS),
    cleanliness: clamp(pet.cleanliness - (STAT_DECAY_PER_DAY.cleanliness * elapsedMs) / DAY_MS),
    happiness: clamp(pet.happiness - (STAT_DECAY_PER_DAY.happiness * elapsedMs) / DAY_MS),
  }
}

// Applies and persists any decay owed since the pet's `last_decay_at`,
// moving that clock forward so the same elapsed time is never decayed twice
// on a subsequent load. Deliberately leaves `updated_at` untouched — decay is
// not an "ordinary record change" and must not postpone anything that keys
// off `updated_at`.
async function applyDecayIfDue({ supabaseUrl, serviceRoleKey, discordUserId, pet }) {
  if (!pet) return pet

  const nowMs = Date.now()
  const decayedStats = computeDecayedStats(pet, nowMs)
  if (!decayedStats) return pet

  return patchPetByDiscordUserId({
    supabaseUrl,
    serviceRoleKey,
    discordUserId,
    payload: {
      hunger: decayedStats.hunger,
      cleanliness: decayedStats.cleanliness,
      happiness: decayedStats.happiness,
      last_decay_at: new Date(nowMs).toISOString(),
    },
  })
}

export async function getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId }) {
  let rows = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const url = buildPetsUrl({
      supabaseUrl,
      discordUserId,
      select: getPetSelectClause(),
      limit: 1,
    })

    const response = await fetch(url, { headers: restHeaders(serviceRoleKey) })
    if (!response.ok) {
      if (await isMissingLastPettedAtColumnResponse(response)) {
        continue
      }
      throw new Error(`supabase_pets_lookup_failed_${response.status}`)
    }

    rows = await response.json()
    break
  }

  if (!rows) {
    throw new Error('supabase_pets_lookup_failed_400')
  }

  const pet = toPet(rows[0])
  if (!pet) return null

  return applyDecayIfDue({ supabaseUrl, serviceRoleKey, discordUserId, pet })
}

// Check-then-insert, with a fallback re-fetch if a race loses the unique
// constraint on discord_user_id — either way, an existing pet is returned
// rather than creating a second one.
export async function createPetIfNotExists({ supabaseUrl, serviceRoleKey, discordUserId, petType, petName }) {
  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (existing) return existing

  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      if (await isMissingLastPettedAtColumnResponse(response)) {
        const current = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
        if (current) return current
        continue
      }
      throw new Error(`supabase_pets_create_failed_${response.status}`)
    }

    const rows = await response.json()
    return toPet(rows[0])
  }

  throw new Error('supabase_pets_create_failed_400')
}

export async function applyPetCareAction({ supabaseUrl, serviceRoleKey, discordUserId, action }) {
  const actionConfig = PET_ACTIONS[action]
  if (!actionConfig) {
    throw new Error('invalid_pet_action')
  }

  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (!existing) return null

  const lastActionAt = existing[actionConfig.petTimestampKey]
  if (lastActionAt) {
    const elapsedMs = Date.now() - new Date(lastActionAt).getTime()
    if (elapsedMs < actionConfig.cooldownMs) {
      const error = new Error('pet_action_on_cooldown')
      error.code = 'pet_action_on_cooldown'
      throw error
    }
  }

  const now = new Date().toISOString()
  const nextValue = Math.min(100, existing[actionConfig.statKey] + actionConfig.delta)
  const payload = {
    [actionConfig.statKey]: nextValue,
    [actionConfig.columnTimestampKey]: now,
    updated_at: now,
  }

  return patchPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId, payload })
}

export async function applyPettingInteraction({ supabaseUrl, serviceRoleKey, discordUserId }) {
  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (!existing) return null

  if (!hasLastPettedAtColumn) {
    const error = new Error('petting_schema_missing')
    error.code = 'petting_schema_missing'
    throw error
  }

  if (getPettingCooldownRemainingMs(existing.lastPettedAt) > 0) {
    const error = new Error('petting_on_cooldown')
    error.code = 'petting_on_cooldown'
    throw error
  }

  const now = new Date().toISOString()
  const url = buildPetsUrl({
    supabaseUrl,
    discordUserId,
    select: getPetSelectClause(),
  })
  url.searchParams.set(
    'or',
    `(last_petted_at.is.null,last_petted_at.lt.${new Date(Date.now() - PETTING_COOLDOWN_MS).toISOString()})`,
  )

  const response = await fetch(url, {
    method: 'PATCH',
    headers: restHeaders(serviceRoleKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      last_petted_at: now,
      updated_at: now,
    }),
  })

  if (!response.ok) {
    throw new Error(`supabase_pets_patch_failed_${response.status}`)
  }

  const rows = await response.json()
  if (rows.length === 0) {
    const error = new Error('petting_on_cooldown')
    error.code = 'petting_on_cooldown'
    throw error
  }

  return toPet(rows[0])
}

export async function getPetSummary({ supabaseUrl, serviceRoleKey, recentLimit = 10 }) {
  let rows = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const url = buildPetsUrl({
      supabaseUrl,
      select: getPetSelectClause({ includeDiscordUserId: true }),
      orderByCreatedAtDesc: true,
    })

    const response = await fetch(url, { headers: restHeaders(serviceRoleKey) })
    if (!response.ok) {
      if (await isMissingLastPettedAtColumnResponse(response)) {
        continue
      }
      throw new Error(`supabase_pets_summary_failed_${response.status}`)
    }

    rows = await response.json()
    break
  }

  if (!rows) {
    throw new Error('supabase_pets_summary_failed_400')
  }

  const pets = rows.map((row) => toPet(row, { includeDiscordUserId: true }))
  const countByType = { axolotl: 0, betta: 0, turtle: 0 }

  for (const pet of pets) {
    if (Object.hasOwn(countByType, pet.petType)) {
      countByType[pet.petType] += 1
    }
  }

  return {
    totalPets: pets.length,
    countByType,
    recentPets: pets.slice(0, recentLimit),
  }
}

export async function listPets({ supabaseUrl, serviceRoleKey, discordUserId, limit = 25 }) {
  let rows = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const url = buildPetsUrl({
      supabaseUrl,
      discordUserId,
      select: getPetSelectClause({ includeDiscordUserId: true }),
      limit,
      orderByCreatedAtDesc: true,
    })

    const response = await fetch(url, { headers: restHeaders(serviceRoleKey) })
    if (!response.ok) {
      if (await isMissingLastPettedAtColumnResponse(response)) {
        continue
      }
      throw new Error(`supabase_pets_list_failed_${response.status}`)
    }

    rows = await response.json()
    break
  }

  if (!rows) {
    throw new Error('supabase_pets_list_failed_400')
  }

  return rows.map((row) => toPet(row, { includeDiscordUserId: true }))
}

export async function updatePetForAdmin({
  supabaseUrl,
  serviceRoleKey,
  discordUserId,
  petType,
  petName,
  statPreset,
  clearActionTimestamps = false,
  simulateElapsedHours,
}) {
  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (!existing) return null

  const payload = {}

  if (petType !== undefined) {
    if (!validatePetType(petType)) {
      throw new Error('invalid_pet_type')
    }
    payload.pet_type = petType
  }

  if (petName !== undefined) {
    const normalizedPetName = validatePetName(petName)
    if (!normalizedPetName) {
      throw new Error('invalid_pet_name')
    }
    payload.pet_name = normalizedPetName
  }

  if (statPreset !== undefined) {
    const stats = getCareStatsPreset(statPreset)
    if (!stats) {
      throw new Error('invalid_stat_preset')
    }
    payload.hunger = stats.hunger
    payload.cleanliness = stats.cleanliness
    payload.happiness = stats.happiness
  }

  if (clearActionTimestamps) {
    payload.last_feed_at = null
    payload.last_clean_at = null
    payload.last_play_at = null
  }

  // Admin-only decay test aid: backdate `last_decay_at` so the next load
  // computes decay as if that much real time had passed. Never touches
  // `updated_at` (that still reflects this admin edit itself, set below) or
  // the last_feed_at/last_clean_at/last_play_at cooldown timestamps.
  if (simulateElapsedHours !== undefined) {
    if (!Number.isFinite(simulateElapsedHours) || simulateElapsedHours <= 0) {
      throw new Error('invalid_simulate_elapsed_hours')
    }
    const cappedHours = Math.min(simulateElapsedHours, MAX_SIMULATED_ELAPSED_HOURS)
    payload.last_decay_at = new Date(Date.now() - cappedHours * 60 * 60 * 1000).toISOString()
  }

  if (Object.keys(payload).length === 0) {
    return existing
  }

  if (!payload.updated_at) {
    payload.updated_at = new Date().toISOString()
  }
  const updated = await patchPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId, payload })

  // Re-read through the decay path so a simulated request immediately shows
  // the decayed result, instead of the raw backdated-but-undecayed row.
  if (simulateElapsedHours !== undefined) {
    return getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  }
  return updated
}

export async function resetPetCooldownsForAdmin({ supabaseUrl, serviceRoleKey, discordUserId }) {
  const existing = await getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
  if (!existing) return null

  await patchPetByDiscordUserId({
    supabaseUrl,
    serviceRoleKey,
    discordUserId,
    payload: {
      last_feed_at: null,
      last_clean_at: null,
      last_play_at: null,
      updated_at: new Date().toISOString(),
    },
  })

  // Return a canonical re-read instead of trusting the immediate PATCH
  // representation so the admin UI and Habitat both see the stored values.
  return getPetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId })
}

export async function deletePetByDiscordUserId({ supabaseUrl, serviceRoleKey, discordUserId }) {
  const url = buildPetsUrl({
    supabaseUrl,
    discordUserId,
    select: getPetSelectClause(),
  })

  const response = await fetch(url, {
    method: 'DELETE',
    headers: restHeaders(serviceRoleKey, {
      Prefer: 'return=representation',
    }),
  })

  if (!response.ok) {
    throw new Error(`supabase_pets_delete_failed_${response.status}`)
  }

  const rows = await response.json()
  return toPet(rows[0])
}
