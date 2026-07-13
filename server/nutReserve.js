const REQUEST_TIMEOUT_MS = 5000

class NutReserveApiError extends Error {
  constructor({
    httpStatus,
    code = null,
    message,
    balance = null,
    pointDisplayName = null,
  }) {
    super(message)
    this.name = 'NutReserveApiError'
    this.httpStatus = httpStatus
    this.code = code
    this.balance = balance
    this.pointDisplayName = pointDisplayName
  }
}

function getNutReserveConfig() {
  const baseUrl = process.env.NUT_RESERVE_API_URL?.trim() || ''
  const apiKey = process.env.NUT_RESERVE_API_KEY?.trim() || ''
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || ''

  if (!baseUrl || !apiKey || !guildId) {
    throw new NutReserveApiError({
      httpStatus: 500,
      message: 'Nut Reserve API configuration is missing.',
    })
  }

  return { baseUrl, apiKey, guildId }
}

function getHeaders(apiKey, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    ...extraHeaders,
  }
}

function normalizeErrorMessage(status, payload, fallbackMessage) {
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }

  if (status === 401) return 'Unauthorized.'
  if (status === 408) return 'Nut Reserve request timed out.'
  return fallbackMessage
}

function toNutReserveError({ status, payload, fallbackMessage }) {
  return new NutReserveApiError({
    httpStatus: status,
    code: typeof payload?.code === 'string' ? payload.code : null,
    message: normalizeErrorMessage(status, payload, fallbackMessage),
    balance: Number.isFinite(payload?.balance) ? payload.balance : null,
    pointDisplayName: typeof payload?.pointDisplayName === 'string'
      ? payload.pointDisplayName
      : null,
  })
}

async function parseJsonResponse(response) {
  const rawText = await response.text()
  if (!rawText) return null

  try {
    return JSON.parse(rawText)
  } catch {
    throw new NutReserveApiError({
      httpStatus: response.status,
      message: 'Nut Reserve returned malformed JSON.',
    })
  }
}

async function callNutReserve({ path, method = 'GET', searchParams, body }) {
  const { baseUrl, apiKey } = getNutReserveConfig()
  const url = new URL(path, baseUrl)

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method,
      headers: getHeaders(
        apiKey,
        body ? { 'Content-Type': 'application/json' } : undefined,
      ),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const payload = await parseJsonResponse(response)

    if (!response.ok) {
      throw toNutReserveError({
        status: response.status,
        payload,
        fallbackMessage: 'Nut Reserve request failed.',
      })
    }

    return payload
  } catch (error) {
    if (error instanceof NutReserveApiError) {
      throw error
    }

    if (error?.name === 'AbortError') {
      throw new NutReserveApiError({
        httpStatus: 408,
        message: 'Nut Reserve request timed out.',
      })
    }

    throw new NutReserveApiError({
      httpStatus: 503,
      message: 'Nut Reserve is unavailable right now.',
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function validateDiscordUserId(discordUserId) {
  if (typeof discordUserId !== 'string' || discordUserId.trim().length === 0) {
    throw new NutReserveApiError({
      httpStatus: 400,
      message: 'discordUserId is required.',
    })
  }

  return discordUserId.trim()
}

export async function getNutReserveBalance(discordUserId) {
  const normalizedDiscordUserId = validateDiscordUserId(discordUserId)
  const { guildId } = getNutReserveConfig()

  const payload = await callNutReserve({
    path: '/api/game/balance',
    searchParams: {
      guildId,
      discordUserId: normalizedDiscordUserId,
    },
  })

  return {
    balance: payload?.balance,
    pointDisplayName: payload?.pointDisplayName ?? null,
  }
}

export async function spendNutReservePoints({
  discordUserId,
  amount,
  reason,
  idempotencyKey,
}) {
  const normalizedDiscordUserId = validateDiscordUserId(discordUserId)
  const { guildId } = getNutReserveConfig()

  const payload = await callNutReserve({
    path: '/api/game/spend',
    method: 'POST',
    body: {
      guildId,
      discordUserId: normalizedDiscordUserId,
      amount,
      reason,
      idempotencyKey,
    },
  })

  return {
    balance: payload?.balance,
    pointDisplayName: payload?.pointDisplayName ?? null,
    ledgerEntryId: payload?.ledgerEntryId ?? null,
    idempotentReplay: payload?.idempotentReplay === true,
    auditWarning: payload?.auditWarning ?? null,
  }
}
