const PET_TYPES = ['axolotl', 'betta', 'turtle']
const PET_PURCHASE_PRICE_POINTS = 20
const PET_PURCHASE_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
}
const PET_PURCHASE_SELECT =
  'purchase_id,discord_user_id,guild_id,pet_type,pet_name,price_points,status,created_at,updated_at,paid_at,payment_failed_at'

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('supabase_config_missing')
  }

  return { supabaseUrl, serviceRoleKey }
}

function restHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: 'application/json',
    ...extra,
  }
}

function getPetPurchasesEndpointUrl(supabaseUrl) {
  const trimmed = String(supabaseUrl).replace(/\/+$/, '')
  const base = trimmed.endsWith('/rest/v1') ? trimmed : `${trimmed}/rest/v1`
  return `${base}/pet_purchases`
}

function buildPetPurchasesUrl({
  supabaseUrl,
  purchaseId,
  discordUserId,
  status,
  excludePurchaseId,
  select = PET_PURCHASE_SELECT,
  limit,
  orderByCreatedAtDesc = false,
}) {
  const url = new URL(getPetPurchasesEndpointUrl(supabaseUrl))

  if (purchaseId) {
    url.searchParams.set('purchase_id', `eq.${purchaseId}`)
  }
  if (discordUserId) {
    url.searchParams.set('discord_user_id', `eq.${discordUserId}`)
  }
  if (status) {
    url.searchParams.set('status', `eq.${status}`)
  }
  if (excludePurchaseId) {
    url.searchParams.set('purchase_id', `neq.${excludePurchaseId}`)
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

function validatePetType(petType) {
  return typeof petType === 'string' && PET_TYPES.includes(petType)
}

function validatePetName(petName) {
  if (typeof petName !== 'string') return null
  const trimmed = petName.trim()
  return trimmed.length > 0 ? trimmed : null
}

function validatePurchaseStatus(status) {
  return Object.values(PET_PURCHASE_STATUSES).includes(status)
}

function toPetPurchase(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('pet_purchase_row_invalid')
  }

  const pricePoints = typeof row.price_points === 'string'
    ? Number(row.price_points)
    : row.price_points

  if (
    typeof row.purchase_id !== 'string' ||
    typeof row.discord_user_id !== 'string' ||
    typeof row.guild_id !== 'string' ||
    !validatePetType(row.pet_type) ||
    !validatePetName(row.pet_name) ||
    pricePoints !== PET_PURCHASE_PRICE_POINTS ||
    !validatePurchaseStatus(row.status) ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    throw new Error('pet_purchase_row_invalid')
  }

  return {
    purchaseId: row.purchase_id,
    discordUserId: row.discord_user_id,
    guildId: row.guild_id,
    petType: row.pet_type,
    petName: row.pet_name.trim(),
    pricePoints,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at ?? null,
    paymentFailedAt: row.payment_failed_at ?? null,
  }
}

async function parseRows(response, { allowEmpty = false } = {}) {
  if (response.status === 409) {
    throw new Error('pet_purchase_pending_conflict')
  }
  if (!response.ok) {
    throw new Error(`supabase_pet_purchases_request_failed_${response.status}`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows)) {
    throw new Error('supabase_pet_purchases_response_invalid')
  }
  if (rows.length === 0) {
    if (allowEmpty) return null
    throw new Error('supabase_pet_purchases_missing_row')
  }

  return toPetPurchase(rows[0])
}

async function patchPetPurchaseById({ purchaseId, payload, status }) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
  const url = buildPetPurchasesUrl({
    supabaseUrl,
    purchaseId,
    status,
  })

  const response = await fetch(url, {
    method: 'PATCH',
    headers: restHeaders(serviceRoleKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(payload),
  })

  return parseRows(response, { allowEmpty: true })
}

export async function createPendingPetPurchase({
  discordUserId,
  guildId,
  petType,
  petName,
}) {
  const normalizedDiscordUserId = typeof discordUserId === 'string' ? discordUserId.trim() : ''
  const normalizedGuildId = typeof guildId === 'string' ? guildId.trim() : ''
  const normalizedPetName = validatePetName(petName)

  if (!normalizedDiscordUserId || !normalizedGuildId || !validatePetType(petType) || !normalizedPetName) {
    throw new Error('invalid_pet_purchase')
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
  const response = await fetch(getPetPurchasesEndpointUrl(supabaseUrl), {
    method: 'POST',
    headers: restHeaders(serviceRoleKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify([{
      discord_user_id: normalizedDiscordUserId,
      guild_id: normalizedGuildId,
      pet_type: petType,
      pet_name: normalizedPetName,
      price_points: PET_PURCHASE_PRICE_POINTS,
      status: PET_PURCHASE_STATUSES.PENDING,
    }]),
  })

  return parseRows(response)
}

export async function getLatestPetPurchaseByDiscordUserId(discordUserId, options = {}) {
  const normalizedDiscordUserId = typeof discordUserId === 'string' ? discordUserId.trim() : ''
  if (!normalizedDiscordUserId) {
    throw new Error('invalid_pet_purchase')
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
  const normalizedStatus = typeof options.status === 'string' && validatePurchaseStatus(options.status)
    ? options.status
    : undefined
  const normalizedExcludePurchaseId =
    typeof options.excludePurchaseId === 'string' && options.excludePurchaseId.trim()
      ? options.excludePurchaseId.trim()
      : undefined
  const url = buildPetPurchasesUrl({
    supabaseUrl,
    discordUserId: normalizedDiscordUserId,
    status: normalizedStatus,
    excludePurchaseId: normalizedExcludePurchaseId,
    limit: 1,
    orderByCreatedAtDesc: true,
  })

  const response = await fetch(url, {
    headers: restHeaders(serviceRoleKey),
  })

  return parseRows(response, { allowEmpty: true })
}

export async function markPetPurchasePaid(purchaseId) {
  const normalizedPurchaseId = typeof purchaseId === 'string' ? purchaseId.trim() : ''
  if (!normalizedPurchaseId) {
    throw new Error('invalid_pet_purchase')
  }

  const now = new Date().toISOString()
  return patchPetPurchaseById({
    purchaseId: normalizedPurchaseId,
    payload: {
      status: PET_PURCHASE_STATUSES.PAID,
      updated_at: now,
      paid_at: now,
      payment_failed_at: null,
    },
  })
}

export async function markPetPurchaseFailed(purchaseId) {
  const normalizedPurchaseId = typeof purchaseId === 'string' ? purchaseId.trim() : ''
  if (!normalizedPurchaseId) {
    throw new Error('invalid_pet_purchase')
  }

  const now = new Date().toISOString()
  return patchPetPurchaseById({
    purchaseId: normalizedPurchaseId,
    payload: {
      status: PET_PURCHASE_STATUSES.PAYMENT_FAILED,
      updated_at: now,
      payment_failed_at: now,
    },
  })
}

export async function deletePendingPetPurchase(purchaseId) {
  const normalizedPurchaseId = typeof purchaseId === 'string' ? purchaseId.trim() : ''
  if (!normalizedPurchaseId) {
    throw new Error('invalid_pet_purchase')
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
  const url = buildPetPurchasesUrl({
    supabaseUrl,
    purchaseId: normalizedPurchaseId,
    status: PET_PURCHASE_STATUSES.PENDING,
  })

  const response = await fetch(url, {
    method: 'DELETE',
    headers: restHeaders(serviceRoleKey, {
      Prefer: 'return=representation',
    }),
  })

  return parseRows(response, { allowEmpty: true })
}
