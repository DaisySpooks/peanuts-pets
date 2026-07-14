import { useEffect, useRef, useState } from 'react'
import { getPetGreetings } from '../petThoughtsApi.js'

// Daily Greeting Thoughts: on the player's first habitat visit of the
// calendar day, show one random greeting before the idle-thought loop
// (useIdlePetThoughts.js) starts. No backend persistence/scheduling per
// spec — "first visit of the day" and "don't repeat the same greeting
// two days running" are tracked client-side in localStorage, same pattern
// as the audio-enabled preference in ../lib/audio.js.
const LAST_SHOWN_DATE_KEY = 'peanuts-pets:last-greeting-date'
const LAST_SHOWN_KEY_KEY = 'peanuts-pets:last-greeting-key'

const DELAY_MIN_MS = 1000
const DELAY_MAX_MS = 2000
const VISIBLE_DURATION_MS = 8000
const FADE_MS = 400

function randomDelay() {
  return DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)
}

function getTodayDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function loadLastShown() {
  if (typeof localStorage === 'undefined') return { date: null, key: null }
  try {
    return {
      date: localStorage.getItem(LAST_SHOWN_DATE_KEY),
      key: localStorage.getItem(LAST_SHOWN_KEY_KEY),
    }
  } catch {
    return { date: null, key: null }
  }
}

function saveLastShown(dateKey, greetingKey) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LAST_SHOWN_DATE_KEY, dateKey)
    localStorage.setItem(LAST_SHOWN_KEY_KEY, greetingKey)
  } catch {
    // Storage unavailable (e.g. private browsing) — the greeting just
    // won't be remembered, so it may show again next visit. Acceptable
    // fallback since there's no server-side tracking either.
  }
}

// Returns { text, visible, active }. `active` is true for as long as the
// greeting flow (pending delay through fade-out) owns the bubble — callers
// pass `!active` as `enabled` to useIdlePetThoughts so idle thoughts don't
// start until the greeting has finished (or there's nothing to show today).
export function useDailyGreeting(temperament) {
  const alreadyShownToday = useRef(loadLastShown().date === getTodayDateKey())
  const [active, setActive] = useState(!alreadyShownToday.current)
  const [greeting, setGreeting] = useState(null)
  const [visible, setVisible] = useState(false)
  const delayTimeoutRef = useRef(null)
  const hideTimeoutRef = useRef(null)
  const endTimeoutRef = useRef(null)
  const fadeInFrameRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined

    if (!temperament) {
      setActive(false)
      return undefined
    }

    let cancelled = false

    getPetGreetings(temperament).then((greetings) => {
      if (cancelled || greetings.length === 0) {
        if (!cancelled) setActive(false)
        return
      }

      const { key: lastKey } = loadLastShown()
      const candidates = greetings.length > 1
        ? greetings.filter((candidate) => candidate.key !== lastKey)
        : greetings
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]

      // Recorded as soon as we commit to showing it (not after the fade-out
      // finishes) so a mid-greeting unmount still counts as today's visit.
      saveLastShown(getTodayDateKey(), chosen.key)

      delayTimeoutRef.current = setTimeout(() => {
        if (cancelled) return

        setGreeting(chosen)
        setVisible(false)
        fadeInFrameRef.current = requestAnimationFrame(() => setVisible(true))

        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false)
          endTimeoutRef.current = setTimeout(() => {
            setGreeting(null)
            setActive(false)
          }, FADE_MS)
        }, VISIBLE_DURATION_MS)
      }, randomDelay())
    })

    return () => {
      cancelled = true
      clearTimeout(delayTimeoutRef.current)
      clearTimeout(hideTimeoutRef.current)
      clearTimeout(endTimeoutRef.current)
      cancelAnimationFrame(fadeInFrameRef.current)
    }
  }, [active, temperament])

  return { text: greeting?.text ?? null, visible, active }
}
