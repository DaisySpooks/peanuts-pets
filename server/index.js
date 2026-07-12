import crypto from 'node:crypto'
import express from 'express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchDiscordIdentity,
  fetchGuildMember,
} from './discord.js'
import { createSessionCookieValue, verifySessionCookieValue } from './session.js'
import { decideAccess, decideAdminAccess } from './access.js'
import {
  applyPetCareAction,
  applyPettingInteraction,
  createPetIfNotExists,
  deletePetByDiscordUserId,
  getPetByDiscordUserId,
  getPetSummary,
  listPets,
  resetPetCooldownsForAdmin,
  toDisplayPet,
  updatePetForAdmin,
  validatePetAction,
  validatePetName,
  validatePetType,
} from './pets.js'

dotenv.config()

const REQUIRED_ENV_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'SESSION_SECRET',
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'DISCORD_PP_HOLDER_ROLE_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
}

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  SESSION_SECRET,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_PP_HOLDER_ROLE_ID,
  // Optional bypass roles — if unset, that bypass simply never matches.
  DISCORD_ADMIN_ROLE_ID,
  DISCORD_TEAM_ROLE_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

const PORT = process.env.PORT || 8787
// Only used to send the browser back to the frontend after the OAuth
// redirect round-trip; not a secret and not part of the token exchange.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const isProduction = process.env.NODE_ENV === 'production'

const STATE_COOKIE_NAME = 'discord_oauth_state'
const SESSION_COOKIE_NAME = 'pp_session'
const STATE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
}

const app = express()
// Railway (and similar PaaS hosts) terminate TLS and proxy over HTTP
// internally — without this, req.ip resolves to the proxy's own address for
// every request, which would collapse accessRateLimiter's per-IP buckets
// below into one shared bucket.
app.set('trust proxy', 1)
app.use(cookieParser())
app.use(express.json())

// Dependency-free health check for Railway's health-check probe: no cookie
// parsing, no Discord/Supabase calls, just confirms the process is up.
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Minimal in-memory fixed-window rate limiter to keep the bot-token-backed
// access check from being hammered. Single-process only — fine for this
// stage since there is no persistence/session store yet either.
const ACCESS_RATE_LIMIT_WINDOW_MS = 60 * 1000
const ACCESS_RATE_LIMIT_MAX = 20
const accessRateLimitHits = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of accessRateLimitHits) {
    if (now - entry.windowStart > ACCESS_RATE_LIMIT_WINDOW_MS) {
      accessRateLimitHits.delete(key)
    }
  }
}, ACCESS_RATE_LIMIT_WINDOW_MS).unref()

function accessRateLimiter(req, res, next) {
  const key = req.ip
  const now = Date.now()
  const entry = accessRateLimitHits.get(key)

  if (!entry || now - entry.windowStart > ACCESS_RATE_LIMIT_WINDOW_MS) {
    accessRateLimitHits.set(key, { count: 1, windowStart: now })
    next()
    return
  }

  entry.count += 1
  if (entry.count > ACCESS_RATE_LIMIT_MAX) {
    res.status(429).json({ authenticated: false, accessGranted: false, reason: 'rate_limited' })
    return
  }

  next()
}

app.get('/auth/discord/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex')

  res.cookie(STATE_COOKIE_NAME, state, {
    ...baseCookieOptions,
    maxAge: STATE_COOKIE_MAX_AGE_MS,
  })

  const authorizeUrl = buildAuthorizeUrl({
    clientId: DISCORD_CLIENT_ID,
    redirectUri: DISCORD_REDIRECT_URI,
    state,
  })

  res.redirect(authorizeUrl)
})

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query
  const expectedState = req.cookies[STATE_COOKIE_NAME]

  res.clearCookie(STATE_COOKIE_NAME, { ...baseCookieOptions })

  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect(`${CLIENT_ORIGIN}/?auth_error=1`)
    return
  }

  try {
    const tokenResponse = await exchangeCodeForToken({
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      redirectUri: DISCORD_REDIRECT_URI,
      code,
    })

    const identity = await fetchDiscordIdentity(tokenResponse.access_token)

    const sessionCookieValue = createSessionCookieValue(
      {
        id: identity.id,
        username: identity.username,
        avatar: identity.avatar,
      },
      SESSION_SECRET,
    )

    res.cookie(SESSION_COOKIE_NAME, sessionCookieValue, {
      ...baseCookieOptions,
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    })

    res.redirect(`${CLIENT_ORIGIN}/`)
  } catch (error) {
    // Deliberately generic: never surface exchange/identity errors, codes,
    // or tokens to the client or logs.
    console.error('Discord OAuth callback failed:', error.message)
    res.redirect(`${CLIENT_ORIGIN}/?auth_error=1`)
  }
})

app.get('/auth/session', (req, res) => {
  const session = verifySessionCookieValue(req.cookies[SESSION_COOKIE_NAME], SESSION_SECRET)

  if (!session) {
    res.json({ authenticated: false })
    return
  }

  res.json({
    authenticated: true,
    user: {
      id: session.id,
      username: session.username,
      avatar: session.avatar,
    },
  })
})

app.get('/auth/access', accessRateLimiter, async (req, res) => {
  const session = verifySessionCookieValue(req.cookies[SESSION_COOKIE_NAME], SESSION_SECRET)

  if (!session) {
    res.json({ authenticated: false, accessGranted: false, reason: 'not_authenticated' })
    return
  }

  try {
    const member = await fetchGuildMember({
      botToken: DISCORD_BOT_TOKEN,
      guildId: DISCORD_GUILD_ID,
      userId: session.id,
    })

    if (!member) {
      res.json({ authenticated: true, accessGranted: false, reason: 'not_in_server' })
      return
    }

    const { granted, reason } = decideAccess(member.roles, {
      ppHolderRoleId: DISCORD_PP_HOLDER_ROLE_ID,
      adminRoleId: DISCORD_ADMIN_ROLE_ID,
      teamRoleId: DISCORD_TEAM_ROLE_ID,
    })

    const adminAccess = decideAdminAccess(member.roles, {
      adminRoleId: DISCORD_ADMIN_ROLE_ID,
      teamRoleId: DISCORD_TEAM_ROLE_ID,
    })

    res.json({
      authenticated: true,
      accessGranted: granted,
      adminAccessGranted: adminAccess.granted,
      reason,
    })
  } catch (error) {
    // Deliberately generic: never surface the bot token, member payload, or
    // raw Discord error details to the client or logs.
    console.error('Discord access check failed:', error.message)
    res.json({ authenticated: true, accessGranted: false, reason: 'discord_unavailable' })
  }
})

app.get('/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { ...baseCookieOptions })
  res.redirect(`${CLIENT_ORIGIN}/`)
})

// Same session + Discord membership/role check as /auth/access, reused
// (not reimplemented) so the pet endpoints below enforce identical rules.
// Attaches req.discordUserId from the signed session only — never trusts
// any user id supplied by the client.
async function requireAccess(req, res, next) {
  const session = verifySessionCookieValue(req.cookies[SESSION_COOKIE_NAME], SESSION_SECRET)
  if (!session) {
    res.status(401).json({ error: 'not_authenticated' })
    return
  }

  try {
    const member = await fetchGuildMember({
      botToken: DISCORD_BOT_TOKEN,
      guildId: DISCORD_GUILD_ID,
      userId: session.id,
    })

    if (!member) {
      res.status(403).json({ error: 'access_denied', reason: 'not_in_server' })
      return
    }

    const { granted, reason } = decideAccess(member.roles, {
      ppHolderRoleId: DISCORD_PP_HOLDER_ROLE_ID,
      adminRoleId: DISCORD_ADMIN_ROLE_ID,
      teamRoleId: DISCORD_TEAM_ROLE_ID,
    })

    if (!granted) {
      res.status(403).json({ error: 'access_denied', reason })
      return
    }
  } catch (error) {
    console.error('Discord access check failed:', error.message)
    res.status(503).json({ error: 'discord_unavailable' })
    return
  }

  req.discordUserId = session.id
  next()
}

async function requireAdminAccess(req, res, next) {
  const session = verifySessionCookieValue(req.cookies[SESSION_COOKIE_NAME], SESSION_SECRET)
  if (!session) {
    res.status(401).json({ error: 'not_authenticated' })
    return
  }

  try {
    const member = await fetchGuildMember({
      botToken: DISCORD_BOT_TOKEN,
      guildId: DISCORD_GUILD_ID,
      userId: session.id,
    })

    if (!member) {
      res.status(403).json({ error: 'access_denied', reason: 'not_in_server' })
      return
    }

    const { granted, reason } = decideAdminAccess(member.roles, {
      adminRoleId: DISCORD_ADMIN_ROLE_ID,
      teamRoleId: DISCORD_TEAM_ROLE_ID,
    })

    if (!granted) {
      res.status(403).json({ error: 'admin_access_denied', reason })
      return
    }
  } catch (error) {
    console.error('Discord admin access check failed:', error.message)
    res.status(503).json({ error: 'discord_unavailable' })
    return
  }

  req.discordUserId = session.id
  next()
}

app.get('/api/pets/me', accessRateLimiter, requireAccess, async (req, res) => {
  try {
    const pet = await getPetByDiscordUserId({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
    })
    res.json({ pet: toDisplayPet(pet) })
  } catch (error) {
    console.error('Pet lookup failed:', error.message)
    res.status(503).json({ error: 'pet_lookup_failed' })
  }
})

app.post('/api/pets/create', accessRateLimiter, requireAccess, async (req, res) => {
  const petType = req.body?.petType
  const petName = validatePetName(req.body?.name)

  if (!validatePetType(petType)) {
    res.status(400).json({ error: 'invalid_pet_type' })
    return
  }
  if (!petName) {
    res.status(400).json({ error: 'invalid_pet_name' })
    return
  }

  try {
    const pet = await createPetIfNotExists({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
      petType,
      petName,
    })
    res.json({ pet: toDisplayPet(pet) })
  } catch (error) {
    console.error('Pet creation failed:', error.message)
    res.status(503).json({ error: 'pet_create_failed' })
  }
})

app.post('/api/pets/:action(feed|clean|play)', accessRateLimiter, requireAccess, async (req, res) => {
  const action = req.params.action

  if (!validatePetAction(action)) {
    res.status(400).json({ error: 'invalid_pet_action' })
    return
  }

  try {
    const pet = await applyPetCareAction({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
      action,
    })

    if (!pet) {
      res.status(404).json({ error: 'pet_not_found' })
      return
    }

    res.json({ pet: toDisplayPet(pet) })
  } catch (error) {
    if (error.code === 'pet_action_on_cooldown') {
      res.status(409).json({ error: 'pet_action_on_cooldown' })
      return
    }
    console.error(`Pet ${action} failed:`, error.message)
    res.status(503).json({ error: 'pet_action_failed' })
  }
})

app.post('/api/pets/pet', accessRateLimiter, requireAccess, async (req, res) => {
  try {
    const pet = await applyPettingInteraction({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
    })

    if (!pet) {
      res.status(404).json({ error: 'pet_not_found' })
      return
    }

    res.json({ pet: toDisplayPet(pet) })
  } catch (error) {
    if (error.code === 'petting_on_cooldown') {
      res.status(409).json({ error: 'petting_on_cooldown' })
      return
    }
    if (error.code === 'petting_schema_missing') {
      res.status(503).json({ error: 'petting_schema_missing' })
      return
    }
    console.error('Petting failed:', error.message)
    res.status(503).json({ error: 'petting_failed' })
  }
})

app.get('/api/admin/summary', accessRateLimiter, requireAdminAccess, async (req, res) => {
  try {
    const summary = await getPetSummary({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    })
    res.json({ ...summary, recentPets: summary.recentPets.map(toDisplayPet) })
  } catch (error) {
    console.error('Admin pet summary failed:', error.message)
    res.status(503).json({ error: 'admin_summary_failed' })
  }
})

app.get('/api/admin/pets', accessRateLimiter, requireAdminAccess, async (req, res) => {
  const discordUserId = typeof req.query?.discordUserId === 'string' ? req.query.discordUserId.trim() : undefined
  const requestedLimit = Number.parseInt(req.query?.limit, 10)
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 25

  try {
    const pets = await listPets({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: discordUserId || undefined,
      limit,
    })
    res.json({ pets: pets.map(toDisplayPet) })
  } catch (error) {
    console.error('Admin pet list failed:', error.message)
    res.status(503).json({ error: 'admin_pets_failed' })
  }
})

app.post('/api/admin/my-pet/update', accessRateLimiter, requireAdminAccess, async (req, res) => {
  try {
    const pet = await updatePetForAdmin({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
      petType: req.body?.petType,
      petName: req.body?.name,
      statPreset: req.body?.statPreset,
      clearActionTimestamps: req.body?.clearActionTimestamps === true,
      simulateElapsedHours: req.body?.simulateElapsedHours !== undefined
        ? Number(req.body.simulateElapsedHours)
        : undefined,
    })

    if (!pet) {
      res.status(404).json({ error: 'pet_not_found' })
      return
    }

    res.json({ pet: toDisplayPet(pet) })
  } catch (error) {
    if (
      error.message === 'invalid_pet_type' ||
      error.message === 'invalid_pet_name' ||
      error.message === 'invalid_stat_preset' ||
      error.message === 'invalid_simulate_elapsed_hours'
    ) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Admin pet update failed:', error.message)
    res.status(503).json({ error: 'admin_pet_update_failed' })
  }
})

app.post('/api/admin/my-pet/reset-cooldowns', accessRateLimiter, requireAdminAccess, async (req, res) => {
  try {
    const pet = await resetPetCooldownsForAdmin({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
    })

    if (!pet) {
      res.status(404).json({ error: 'pet_not_found' })
      return
    }

    res.json({ pet: toDisplayPet(pet) })
  } catch (error) {
    console.error('Admin pet cooldown reset failed:', error.message)
    res.status(503).json({ error: 'admin_pet_reset_cooldowns_failed' })
  }
})

app.delete('/api/admin/my-pet', accessRateLimiter, requireAdminAccess, async (req, res) => {
  try {
    const deletedPet = await deletePetByDiscordUserId({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUserId: req.discordUserId,
    })

    if (!deletedPet) {
      res.status(404).json({ error: 'pet_not_found' })
      return
    }

    res.json({ pet: toDisplayPet(deletedPet) })
  } catch (error) {
    console.error('Admin pet delete failed:', error.message)
    res.status(503).json({ error: 'admin_pet_delete_failed' })
  }
})

app.listen(PORT, () => {
  console.log(`Auth server listening on port ${PORT}`)
})
