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
    getLatestPetPurchaseByDiscordUserId: async () => null,
    listEarnedPersonalityUnlockKeys: async () => [],
    supabaseUrl: 'https://supabase.example',
    serviceRoleKey: 'service-role-key',
    logger: { error() {} },
    ...overrides,
  }
}

test.before(async () => {
  process.env.DISCORD_CLIENT_ID = 'test'
  process.env.DISCORD_CLIENT_SECRET = 'test'
  process.env.DISCORD_REDIRECT_URI = 'http://localhost/auth/discord/callback'
  process.env.SESSION_SECRET = 'test'
  process.env.DISCORD_BOT_TOKEN = 'test'
  process.env.DISCORD_GUILD_ID = 'guild-1'
  process.env.DISCORD_PP_HOLDER_ROLE_ID = 'role-1'
  process.env.SUPABASE_URL = 'https://supabase.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
})

test('no pet preserves existing no-pet response', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps())
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { pet: null })
})

test('grandfathered pet returns normally', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.petName, 'Mochi')
})

test('PAID pet returns normally', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PAID' }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pet.petName, 'Mochi')
})

test('pet read returns earned personality unlock keys', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PAID' }),
    listEarnedPersonalityUnlockKeys: async () => ['playful_happy_bounce', 'playful_playtime_welcome'],
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.pet.earnedPersonalityUnlockKeys, ['playful_happy_bounce', 'playful_playtime_welcome'])
})

test('pet read returns an empty earned personality unlock key list when no records exist', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PAID' }),
    listEarnedPersonalityUnlockKeys: async () => [],
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.pet.earnedPersonalityUnlockKeys, [])
})

test('PAYMENT_FAILED pet is blocked', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PAYMENT_FAILED' }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 402)
  assert.deepEqual(res.body, { error: 'pet_payment_failed' })
})

test('PENDING pet is blocked', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => createPurchase({ status: 'PENDING' }),
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 409)
  assert.deepEqual(res.body, { error: 'pet_create_in_progress' })
})

test('purchase lookup failure is handled safely', async () => {
  const { getMyPetRouteHandler } = await import('./index.js')
  const handler = getMyPetRouteHandler(createDeps({
    getPetByDiscordUserId: async () => createPet(),
    getLatestPetPurchaseByDiscordUserId: async () => {
      throw new Error('database exploded')
    },
  }))
  const res = createMockRes()

  await handler({ discordUserId: 'user-1' }, res)

  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'pet_lookup_failed' })
})
