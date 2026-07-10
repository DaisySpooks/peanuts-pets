const DISCORD_API_BASE = 'https://discord.com/api'

// Smallest scope needed for basic identity only. Deliberately no `guilds`,
// `guilds.members.read`, or anything that would let this app check server
// membership or roles — that is out of scope for this implementation.
const OAUTH_SCOPE = 'identify'

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL(`${DISCORD_API_BASE}/oauth2/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', OAUTH_SCOPE)
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

export async function exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`discord_token_exchange_failed_${response.status}`)
  }

  return response.json()
}

export async function fetchGuildMember({ botToken, guildId, userId }) {
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  })

  if (response.status === 404) {
    // Discord uses 404 for more than one situation here, and they must not
    // be conflated: code 10007 "Unknown Member" means the user genuinely
    // isn't in the guild (a normal, expected outcome). Any other code (e.g.
    // 10004 "Unknown Guild", meaning the bot itself has no access to the
    // configured guild) is a setup problem, not a real membership result —
    // treat it as an error so it doesn't get reported as "not in server".
    const body = await response.json().catch(() => null)
    if (body?.code === 10007) {
      return null
    }
    throw new Error(`discord_guild_member_fetch_failed_404_code_${body?.code ?? 'unknown'}`)
  }

  if (!response.ok) {
    throw new Error(`discord_guild_member_fetch_failed_${response.status}`)
  }

  const member = await response.json()
  return { roles: Array.isArray(member.roles) ? member.roles : [] }
}

export async function fetchDiscordIdentity(accessToken) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`discord_identity_fetch_failed_${response.status}`)
  }

  const user = await response.json()

  // Only the minimal identity fields needed for the session — no email,
  // no locale, no other profile data.
  return {
    id: user.id,
    username: user.global_name || user.username,
    avatar: user.avatar || null,
  }
}
