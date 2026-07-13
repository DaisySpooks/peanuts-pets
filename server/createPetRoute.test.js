import assert from 'node:assert/strict'
import test from 'node:test'

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

function createPet(overrides = {}) {
  return {
    petType: 'axolotl',
    petName: 'Mochi',
    createdAt: '2026-07-12T12:00:00.000Z',
    hunger: 78,
    cleanliness: 86,
    happiness: 92,
    affection: 0,
    colour: 'pink',
    temperament: 'gentle',
    lastFeedAt: null,
    lastCleanAt: null,
    lastPlayAt: null,
    lastPettedAt: null,
    updatedAt: '2026-07-12T12:00:00.000Z',
    lastDecayAt: '2026-07-12T12:00:00.000Z',
    ...overrides,
  }
}

function createPurchase(overrides = {}) {
  return {
    purchaseId: 'purchase-1',
    discordUserId: 'user-1',
    guildId: 'guild-1',
    petType: 'axolotl',
    petName: 'Mochi',
    pricePoints: 20,
    status: 'PENDING',
    createdAt: '2026-07-12T12:00:00.000Z',
    updatedAt: '2026-07-12T12:00:00.000Z',
    paidAt: null,
    paymentFailedAt: null,
    ...overrides,
  }
}

function createDeps(overrides = {}) {
  return {
    getPetByDiscordUserId: async () => null,
    createPetIfNotExists: async () => createPet(),
    getNutReserveBalance: async () => ({
      balance: 40,
      pointDisplayName: 'Nutshells',
    }),
    spendNutReservePoints: async () => ({
      balance: 20,
      pointDisplayName: 'Nutshells',
      ledgerEntryId: 'ledger-1',
      idempotentReplay: false,
      auditWarning: null,
    }),
    createPendingPetPurchase: async () => createPurchase(),
    getLatestPetPurchaseByDiscordUserId: async () => null,
    markPetPurchasePaid: async () => createPurchase({ status: 'PAID' }),
    markPetPurchaseFailed: async () => createPurchase({ status: 'PAYMENT_FAILED' }),
    deletePendingPetPurchase: async () => createPurchase(),
    supabaseUrl: 'https://supabase.example',
    serviceRoleKey: 'service-role-key',
    guildId: 'guild-1',
    logger: { error() {} },
    ...overrides,
  }
}

test('grandfathered existing pet returns normally', async () => {
  process.env.DISCORD_CLIENT_ID = 'test'
  process.env.DISCORD_CLIENT_SECRET = 'test'
  process.env.DISCORD_REDIRECT_URI = 'http://localhost/auth/discord/callback'
  process.env.SESSION_SECRET = 'test'
  process.env.DISCORD_BOT_TOKEN = 'test'
  process.env.DISCORD_GUILD_ID = 'guild-1'
  process.env.DISCORD_PP_HOLDER_ROLE_ID = 'role-1'
  process.env.SUPABASE_URL = 'https://supabase.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
  }))
  const res = createMockRes()

  await handler({
    discordUserId: 'user-1',
    body: { petType: 'axolotl', name: 'Mochi' },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.petName, 'Mochi')
})

test('existing PAID pet returns normally', async () => {
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PAID' }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.petName, 'Mochi')
})

test('existing PAYMENT_FAILED pet is blocked', async () => {
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PAYMENT_FAILED' }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(res.statusCode, 402)
  assert.deepEqual(res.body, { error: 'pet_payment_failed' })
})

test('insufficient balance returns 402 with safe details', async () => {
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    getNutReserveBalance: async () => ({
      balance: 5,
      pointDisplayName: 'Nutshells',
    }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(res.statusCode, 402)
  assert.deepEqual(res.body, {
    error: 'insufficient_points',
    balance: 5,
    pointDisplayName: 'Nutshells',
  })
})

test('successful purchase flow creates, spends, marks paid, and returns pet', async () => {
  const events = []
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    createPendingPetPurchase: async () => {
      events.push('createPending')
      return createPurchase()
    },
    createPetIfNotExists: async () => {
      events.push('createPet')
      return createPet()
    },
    spendNutReservePoints: async () => {
      events.push('spend')
      return {
        balance: 20,
        pointDisplayName: 'Nutshells',
        ledgerEntryId: 'ledger-1',
        idempotentReplay: false,
        auditWarning: null,
      }
    },
    markPetPurchasePaid: async () => {
      events.push('markPaid')
      return createPurchase({ status: 'PAID' })
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.deepEqual(events, ['createPending', 'createPet', 'spend', 'markPaid'])
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.petName, 'Mochi')
})

test('pet creation failure deletes pending row', async () => {
  let deletedPurchaseId = null
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    createPetIfNotExists: async () => {
      throw new Error('insert failed')
    },
    deletePendingPetPurchase: async (purchaseId) => {
      deletedPurchaseId = purchaseId
      return createPurchase()
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(deletedPurchaseId, 'purchase-1')
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'pet_create_failed' })
})

test('spend failure marks PAYMENT_FAILED and returns safe details', async () => {
  let markedFailedPurchaseId = null
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    spendNutReservePoints: async () => {
      const error = new Error('insufficient')
      error.code = 'INSUFFICIENT_POINTS'
      error.balance = 0
      error.pointDisplayName = 'Nutshells'
      throw error
    },
    markPetPurchaseFailed: async (purchaseId) => {
      markedFailedPurchaseId = purchaseId
      return createPurchase({ status: 'PAYMENT_FAILED' })
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(markedFailedPurchaseId, 'purchase-1')
  assert.equal(res.statusCode, 402)
  assert.deepEqual(res.body, {
    error: 'pet_payment_failed',
    code: 'INSUFFICIENT_POINTS',
    balance: 0,
    pointDisplayName: 'Nutshells',
  })
})

test('idempotent spend replay still returns the pet and marks paid', async () => {
  let markPaidCount = 0
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    spendNutReservePoints: async () => ({
      balance: 20,
      pointDisplayName: 'Nutshells',
      ledgerEntryId: 'ledger-1',
      idempotentReplay: true,
      auditWarning: null,
    }),
    markPetPurchasePaid: async () => {
      markPaidCount += 1
      return createPurchase({ status: 'PAID' })
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(markPaidCount, 1)
  assert.equal(res.statusCode, 200)
})

test('Nut Reserve balance failure returns 503', async () => {
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    getNutReserveBalance: async () => {
      throw new Error('timeout')
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'balance_check_failed' })
})

test('duplicate create request does not double-charge', async () => {
  let spendCalls = 0
  const { createPetRouteHandler } = await import('./index.js')
  const handler = createPetRouteHandler(createDeps({
    createPendingPetPurchase: async () => createPurchase({ purchaseId: 'purchase-2' }),
    createPetIfNotExists: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async (discordUserId, options = {}) => {
      if (options.excludePurchaseId === 'purchase-2') {
        return createPurchase({ purchaseId: 'purchase-1', status: 'PAID' })
      }
      return null
    },
    spendNutReservePoints: async () => {
      spendCalls += 1
      return {
        balance: 20,
        pointDisplayName: 'Nutshells',
        ledgerEntryId: 'ledger-1',
        idempotentReplay: false,
        auditWarning: null,
      }
    },
    deletePendingPetPurchase: async () => createPurchase({ purchaseId: 'purchase-2' }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1', body: { petType: 'axolotl', name: 'Mochi' } }, res)

  assert.equal(spendCalls, 0)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.petName, 'Mochi')
})
