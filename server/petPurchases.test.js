import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPendingPetPurchase,
  deletePendingPetPurchase,
  getLatestPetPurchaseByDiscordUserId,
  markPetPurchaseFailed,
  markPetPurchasePaid,
} from './petPurchases.js'

const ORIGINAL_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
}

function setRequiredEnv() {
  process.env.SUPABASE_URL = 'https://supabase.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function createPurchaseRow(overrides = {}) {
  return {
    purchase_id: 'purchase-1',
    discord_user_id: 'user-1',
    guild_id: 'guild-1',
    pet_type: 'axolotl',
    pet_name: 'Mochi',
    price_points: 20,
    status: 'PENDING',
    created_at: '2026-07-12T12:00:00.000Z',
    updated_at: '2026-07-12T12:00:00.000Z',
    paid_at: null,
    payment_failed_at: null,
    ...overrides,
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

test('creating PENDING purchase persists fixed price 20', async () => {
  global.fetch = async (input, init) => {
    assert.equal(input, 'https://supabase.example/rest/v1/pet_purchases')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.apikey, 'service-role-key')
    assert.equal(init.headers.Authorization, 'Bearer service-role-key')
    assert.equal(init.headers.Prefer, 'return=representation')
    const payload = JSON.parse(init.body)
    assert.deepEqual(payload, [{
      discord_user_id: 'user-1',
      guild_id: 'guild-1',
      pet_type: 'axolotl',
      pet_name: 'Mochi',
      price_points: 20,
      status: 'PENDING',
    }])
    return createJsonResponse([createPurchaseRow()])
  }

  const result = await createPendingPetPurchase({
    discordUserId: 'user-1',
    guildId: 'guild-1',
    petType: 'axolotl',
    petName: 'Mochi',
  })

  assert.equal(result.pricePoints, 20)
  assert.equal(result.status, 'PENDING')
})

test('reading latest purchase returns newest row', async () => {
  global.fetch = async (input, init) => {
    const url = new URL(input)
    assert.equal(url.pathname, '/rest/v1/pet_purchases')
    assert.equal(url.searchParams.get('discord_user_id'), 'eq.user-2')
    assert.equal(url.searchParams.get('limit'), '1')
    assert.equal(url.searchParams.get('order'), 'created_at.desc')
    assert.equal(init.headers.apikey, 'service-role-key')
    return createJsonResponse([createPurchaseRow({
      purchase_id: 'purchase-2',
      discord_user_id: 'user-2',
      status: 'PAID',
    })])
  }

  const result = await getLatestPetPurchaseByDiscordUserId('user-2')
  assert.equal(result.purchaseId, 'purchase-2')
  assert.equal(result.discordUserId, 'user-2')
  assert.equal(result.status, 'PAID')
})

test('marking PAID updates purchase status and timestamps', async () => {
  global.fetch = async (input, init) => {
    const url = new URL(input)
    assert.equal(url.searchParams.get('purchase_id'), 'eq.purchase-3')
    assert.equal(init.method, 'PATCH')
    const payload = JSON.parse(init.body)
    assert.equal(payload.status, 'PAID')
    assert.equal(typeof payload.updated_at, 'string')
    assert.equal(typeof payload.paid_at, 'string')
    assert.equal(payload.payment_failed_at, null)
    return createJsonResponse([createPurchaseRow({
      purchase_id: 'purchase-3',
      status: 'PAID',
      updated_at: payload.updated_at,
      paid_at: payload.paid_at,
    })])
  }

  const result = await markPetPurchasePaid('purchase-3')
  assert.equal(result.status, 'PAID')
  assert.equal(typeof result.paidAt, 'string')
})

test('marking PAYMENT_FAILED updates purchase status and timestamp', async () => {
  global.fetch = async (input, init) => {
    const url = new URL(input)
    assert.equal(url.searchParams.get('purchase_id'), 'eq.purchase-4')
    assert.equal(init.method, 'PATCH')
    const payload = JSON.parse(init.body)
    assert.equal(payload.status, 'PAYMENT_FAILED')
    assert.equal(typeof payload.updated_at, 'string')
    assert.equal(typeof payload.payment_failed_at, 'string')
    return createJsonResponse([createPurchaseRow({
      purchase_id: 'purchase-4',
      status: 'PAYMENT_FAILED',
      updated_at: payload.updated_at,
      payment_failed_at: payload.payment_failed_at,
    })])
  }

  const result = await markPetPurchaseFailed('purchase-4')
  assert.equal(result.status, 'PAYMENT_FAILED')
  assert.equal(typeof result.paymentFailedAt, 'string')
})

test('deleting only a PENDING purchase returns null when row is not pending', async () => {
  global.fetch = async (input, init) => {
    const url = new URL(input)
    assert.equal(url.searchParams.get('purchase_id'), 'eq.purchase-5')
    assert.equal(url.searchParams.get('status'), 'eq.PENDING')
    assert.equal(init.method, 'DELETE')
    return createJsonResponse([])
  }

  const result = await deletePendingPetPurchase('purchase-5')
  assert.equal(result, null)
})

test('malformed rows and missing rows are handled safely', async () => {
  global.fetch = async () => createJsonResponse([createPurchaseRow({
    price_points: 19,
  })])

  await assert.rejects(
    getLatestPetPurchaseByDiscordUserId('user-6'),
    /pet_purchase_row_invalid/,
  )

  global.fetch = async () => createJsonResponse([])
  const emptyResult = await getLatestPetPurchaseByDiscordUserId('user-6')
  assert.equal(emptyResult, null)
})
