import { useEffect, useState } from 'react'
import { getAccess, getSession } from './discordAuth.js'

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
        getAccess().then((accessResult) => {
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
