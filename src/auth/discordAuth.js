// Frontend auth boundary. This module never sees a client secret, an
// access/refresh token, or performs any server/role checks itself — it only
// starts the redirect and reads back the minimal session the server sets.

export function loginWithDiscord() {
  window.location.href = '/auth/discord/login'
}

export function logout() {
  window.location.href = '/auth/logout'
}

export async function getSession() {
  const response = await fetch('/auth/session', { credentials: 'include' })
  if (!response.ok) {
    return { authenticated: false }
  }
  return response.json()
}

// Server-side Discord server-membership + role check. The frontend only
// ever receives { authenticated, accessGranted, reason } — never guild or
// role data.
export async function getAccess() {
  const response = await fetch('/auth/access', { credentials: 'include' })
  if (!response.ok) {
    return { authenticated: false, accessGranted: false, reason: 'discord_unavailable' }
  }
  return response.json()
}
