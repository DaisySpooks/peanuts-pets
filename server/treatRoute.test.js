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
    affection: 5,
    lifetimeAffection: 12,
    colour: 'pink',
    temperament: 'curious',
    lastFeedAt: null,
    lastCleanAt: null,
    lastPlayAt: null,
    lastPettedAt: null,
    lastTreatAt: null,
    updatedAt: '2026-07-12T12:00:00.000Z',
    lastDecayAt: '2026-07-12T12:00:00.000Z',
    ...overrides,
  }
}

function createDeps(overrides = {}) {
  return {
    getPetByDiscordUserId: async () => createPet(),
    applyPetTreat: async () => createPet({
      affection: 6,
      lifetimeAffection: 13,
      lastTreatAt: new Date().toISOString(),
    }),
    spendNutReservePoints: async () => ({
      balance: 15,
      pointDisplayName: 'Nutshells',
      ledgerEntryId: 'ledger-1',
      idempotentReplay: false,
      auditWarning: null,
    }),
    supabaseUrl: 'https://supabase.example',
    serviceRoleKey: 'service-role-key',
    logger: { error() {} },
    ...overrides,
  }
}

function setRequiredEnv() {
  process.env.DISCORD_CLIENT_ID = 'test'
  process.env.DISCORD_CLIENT_SECRET = 'test'
  process.env.DISCORD_REDIRECT_URI = 'http://localhost/auth/discord/callback'
  process.env.SESSION_SECRET = 'test'
  process.env.DISCORD_BOT_TOKEN = 'test'
  process.env.DISCORD_GUILD_ID = 'guild-1'
  process.env.DISCORD_PP_HOLDER_ROLE_ID = 'role-1'
  process.env.SUPABASE_URL = 'https://supabase.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
}

test('spends 5 Nutshells and returns the updated pet on success', async () => {
  setRequiredEnv()
  const { treatPetRouteHandler } = await import('./index.js')

  const spendCalls = []
  const handler = treatPetRouteHandler(createDeps({
    spendNutReservePoints: async (args) => {
      spendCalls.push(args)
      return { balance: 15, pointDisplayName: 'Nutshells', ledgerEntryId: 'ledger-1', idempotentReplay: false, auditWarning: null }
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.affection, 6)
  assert.equal(res.body.pet.lifetimeAffection, 13)
  assert.equal(spendCalls.length, 1)
  assert.equal(spendCalls[0].amount, 5)
  assert.equal(spendCalls[0].discordUserId, 'user-1')
})

test('already treated today is rejected without spending anything', async () => {
  setRequiredEnv()
  const { treatPetRouteHandler } = await import('./index.js')

  let spendCalled = false
  const handler = treatPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet({ lastTreatAt: new Date().toISOString() }),
    spendNutReservePoints: async () => {
      spendCalled = true
      return { balance: 15, pointDisplayName: 'Nutshells' }
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 409)
  assert.deepEqual(res.body, { error: 'treat_already_given_today' })
  assert.equal(spendCalled, false)
})

test('failed spend does not grant the treat', async () => {
  setRequiredEnv()
  const { treatPetRouteHandler } = await import('./index.js')

  let applyTreatCalled = false
  const handler = treatPetRouteHandler(createDeps({
    spendNutReservePoints: async () => {
      const error = new Error('The member does not have enough Nutshells.')
      error.code = 'INSUFFICIENT_POINTS'
      error.balance = 2
      error.pointDisplayName = 'Nutshells'
      throw error
    },
    applyPetTreat: async () => {
      applyTreatCalled = true
      return createPet({ lifetimeAffection: 13 })
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 402)
  assert.equal(res.body.error, 'pet_payment_failed')
  assert.equal(res.body.balance, 2)
  // A failed spend must never reach applyPetTreat — no pet mutation, no
  // affection grant of any kind, and no `pet` field in the response.
  assert.equal(applyTreatCalled, false)
  assert.equal(res.body.pet, undefined)
})

test('missing pet returns 404', async () => {
  setRequiredEnv()
  const { treatPetRouteHandler } = await import('./index.js')

  const handler = treatPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => null,
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { error: 'pet_not_found' })
})
