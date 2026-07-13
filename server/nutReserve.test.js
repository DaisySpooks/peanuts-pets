import assert from 'node:assert/strict'
import test from 'node:test'

import { getNutReserveBalance, spendNutReservePoints } from './nutReserve.js'

const ORIGINAL_ENV = {
  NUT_RESERVE_API_URL: process.env.NUT_RESERVE_API_URL,
  NUT_RESERVE_API_KEY: process.env.NUT_RESERVE_API_KEY,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
}

function setRequiredEnv() {
  process.env.NUT_RESERVE_API_URL = 'https://nut-reserve.example'
  process.env.NUT_RESERVE_API_KEY = 'super-secret-key'
  process.env.DISCORD_GUILD_ID = 'guild-123'
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

test.beforeEach(() => {
  setRequiredEnv()
})

test.afterEach(() => {
  restoreEnv()
  global.fetch = undefined
})

test('successful balance response is normalized', async () => {
  global.fetch = async (input, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(init.headers.Authorization, 'Bearer super-secret-key')
    const url = new URL(input)
    assert.equal(url.pathname, '/api/game/balance')
    assert.equal(url.searchParams.get('guildId'), 'guild-123')
    assert.equal(url.searchParams.get('discordUserId'), 'user-1')
    return createJsonResponse({
      ok: true,
      guildId: 'guild-123',
      discordUserId: 'user-1',
      balance: 125,
      pointDisplayName: 'Nutshells',
    })
  }

  const result = await getNutReserveBalance('user-1')
  assert.deepEqual(result, {
    balance: 125,
    pointDisplayName: 'Nutshells',
  })
})

test('successful spend response is normalized', async () => {
  global.fetch = async (input, init) => {
    const url = new URL(input)
    assert.equal(url.pathname, '/api/game/spend')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.Authorization, 'Bearer super-secret-key')
    assert.equal(init.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(init.body), {
      guildId: 'guild-123',
      discordUserId: 'user-2',
      amount: 20,
      reason: 'peanuts_pets_first_pet_purchase',
      idempotencyKey: 'purchase-123',
    })
    return createJsonResponse({
      ok: true,
      guildId: 'guild-123',
      discordUserId: 'user-2',
      balance: 40,
      pointDisplayName: 'Nutshells',
      ledgerEntryId: 'ledger-spend-1',
      idempotentReplay: false,
      auditWarning: null,
    })
  }

  const result = await spendNutReservePoints({
    discordUserId: 'user-2',
    amount: 20,
    reason: 'peanuts_pets_first_pet_purchase',
    idempotencyKey: 'purchase-123',
  })

  assert.deepEqual(result, {
    balance: 40,
    pointDisplayName: 'Nutshells',
    ledgerEntryId: 'ledger-spend-1',
    idempotentReplay: false,
    auditWarning: null,
  })
})

test('insufficient-points response is preserved', async () => {
  global.fetch = async () => createJsonResponse({
    error: 'The member does not have enough Nutshells.',
    code: 'INSUFFICIENT_POINTS',
    balance: 10,
    pointDisplayName: 'Nutshells',
  }, { status: 409 })

  await assert.rejects(
    spendNutReservePoints({
      discordUserId: 'user-3',
      amount: 20,
      reason: 'peanuts_pets_first_pet_purchase',
      idempotencyKey: 'purchase-456',
    }),
    (error) => {
      assert.equal(error.name, 'NutReserveApiError')
      assert.equal(error.httpStatus, 409)
      assert.equal(error.code, 'INSUFFICIENT_POINTS')
      assert.equal(error.message, 'The member does not have enough Nutshells.')
      assert.equal(error.balance, 10)
      assert.equal(error.pointDisplayName, 'Nutshells')
      return true
    },
  )
})

test('idempotency conflict response is preserved', async () => {
  global.fetch = async () => createJsonResponse({
    error: 'This idempotency key was already used for a different external game balance request.',
    code: 'IDEMPOTENCY_CONFLICT',
    balance: null,
    pointDisplayName: 'Nutshells',
  }, { status: 409 })

  await assert.rejects(
    spendNutReservePoints({
      discordUserId: 'user-4',
      amount: 20,
      reason: 'peanuts_pets_first_pet_purchase',
      idempotencyKey: 'purchase-789',
    }),
    (error) => {
      assert.equal(error.httpStatus, 409)
      assert.equal(error.code, 'IDEMPOTENCY_CONFLICT')
      assert.equal(
        error.message,
        'This idempotency key was already used for a different external game balance request.',
      )
      assert.equal(error.balance, null)
      assert.equal(error.pointDisplayName, 'Nutshells')
      return true
    },
  )
})

test('unauthorized response is preserved', async () => {
  global.fetch = async () => createJsonResponse({
    error: 'Unauthorized.',
  }, { status: 401 })

  await assert.rejects(
    getNutReserveBalance('user-5'),
    (error) => {
      assert.equal(error.httpStatus, 401)
      assert.equal(error.code, null)
      assert.equal(error.message, 'Unauthorized.')
      assert.equal(error.balance, null)
      assert.equal(error.pointDisplayName, null)
      return true
    },
  )
})

test('malformed JSON response is surfaced safely', async () => {
  global.fetch = async () => new Response('not-json', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.rejects(
    getNutReserveBalance('user-6'),
    (error) => {
      assert.equal(error.httpStatus, 200)
      assert.equal(error.message, 'Nut Reserve returned malformed JSON.')
      return true
    },
  )
})

test('network failure becomes a safe unavailable error', async () => {
  global.fetch = async () => {
    throw new Error('socket hang up')
  }

  await assert.rejects(
    getNutReserveBalance('user-7'),
    (error) => {
      assert.equal(error.httpStatus, 503)
      assert.equal(error.code, null)
      assert.equal(error.message, 'Nut Reserve is unavailable right now.')
      return true
    },
  )
})

test('timeout becomes a safe timeout error', async () => {
  global.fetch = async (input, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    })
  })

  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  let cleared = false

  global.setTimeout = ((callback) => {
    queueMicrotask(callback)
    return { fake: true }
  })
  global.clearTimeout = ((timeoutId) => {
    if (timeoutId?.fake) cleared = true
  })

  try {
    await assert.rejects(
      getNutReserveBalance('user-8'),
      (error) => {
        assert.equal(error.httpStatus, 408)
        assert.equal(error.code, null)
        assert.equal(error.message, 'Nut Reserve request timed out.')
        assert.equal(cleared, true)
        return true
      },
    )
  } finally {
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})
