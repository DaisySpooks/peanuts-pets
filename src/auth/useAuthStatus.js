import { useEffect, useState } from 'react'
import { getAccess, getSession } from './discordAuth.js'

// Reasons that mean "we couldn't check right now", not "you don't have
// access" — a retry (or the last known-good result) is appropriate.
// Anything not in this list and not a definitive denial below falls back to
// the same "temporary" handling, since an unrecognized reason is more likely
// a transient server hiccup than a new kind of denial.
const TEMPORARY_ACCESS_REASONS = new Set(['rate_limited', 'discord_unavailable'])

// Only these mean the server actually evaluated membership/role and said no
// — these are the sole reasons allowed to revoke a previously granted access.
const DEFINITIVE_DENIAL_REASONS = new Set(['not_authenticated', 'not_in_server', 'missing_role'])

const ACCESS_RETRY_DELAY_MS = 1200

// Module-level (not component state) so it's shared across every
// useAuthStatus() call in this page session — both App's and LoginScreen's
// independent hook instances see the same last-confirmed-granted result,
// which is what lets a fresh instance's transient failure fall back to a
// genuinely already-known-good state instead of flashing a denial.
let lastKnownGrantedAccess = null

// Wraps getAccess() so a thrown network error (offline, DNS failure, etc.)
// is treated the same as the server's own temporary-failure responses,
// rather than becoming an unhandled rejection that never resolves `access`.
async function safeGetAccess() {
  try {
    return await getAccess()
  } catch {
    return { authenticated: true, accessGranted: false, reason: 'discord_unavailable' }
  }
}

// One retry after a short delay for temporary failures; if that retry is
// also temporary, prefer a previously-confirmed grant (from this instance or
// any other) over flipping the user to a denied/unavailable screen. Only a
// definitive denial reason is trusted immediately, with no retry.
async function fetchAccessWithResilience() {
  const first = await safeGetAccess()
  if (first.accessGranted) {
    lastKnownGrantedAccess = first
    return first
  }
  if (DEFINITIVE_DENIAL_REASONS.has(first.reason)) {
    return first
  }

  await new Promise((resolve) => setTimeout(resolve, ACCESS_RETRY_DELAY_MS))
  const retry = await safeGetAccess()
  if (retry.accessGranted) {
    lastKnownGrantedAccess = retry
    return retry
  }
  if (DEFINITIVE_DENIAL_REASONS.has(retry.reason)) {
    return retry
  }

  // Still no definitive answer after the retry — a temporary/unrecognized
  // reason. Preserve the last known granted access if we have one, rather
  // than replacing it with this transient failure.
  return lastKnownGrantedAccess || retry
}

// Shared session + access-check status, used by both the login/access
// screen and App's top-level routing decision. Extracted so there is a
// single place doing this fetch — behavior is unchanged from before.
export function useAuthStatus() {
  const [session, setSession] = useState(null)
  const [access, setAccess] = useState(null)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth_error')) {
      setAuthError(true)
      params.delete('auth_error')
      const cleanedSearch = params.toString()
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}`,
      )
    }

    let cancelled = false
    getSession().then((result) => {
      if (cancelled) return
      setSession(result)
      if (result.authenticated) {
        fetchAccessWithResilience().then((accessResult) => {
          if (!cancelled) setAccess(accessResult)
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const isAuthenticated = session?.authenticated === true
  const isCheckingAccess = isAuthenticated && access === null
  const accessGranted = access?.accessGranted === true

  return { session, access, authError, isAuthenticated, isCheckingAccess, accessGranted }
}
