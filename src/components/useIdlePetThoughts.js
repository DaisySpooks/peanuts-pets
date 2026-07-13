import { useEffect, useRef, useState } from 'react'
import { getPetThoughts } from '../petThoughtsApi.js'

// Phase 1 idle-thought timing: silence for a random 20-40s, then a thought
// bubble holds for ~6s, then fades out and the next silence begins. No
// thought fires immediately on mount — the first tick is itself a random
// delay, same as useIdleBlink's scheduleNextBlink pattern.
const DELAY_MIN_MS = 20000
const DELAY_MAX_MS = 40000
const VISIBLE_DURATION_MS = 6000
const FADE_MS = 400

function randomDelay() {
  return DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)
}

// Fetches the pet's temperament thought pool once and runs the idle-thought
// timer loop while the caller stays mounted (i.e. while the habitat is
// open). Returns { text, visible } — `text` stays set through the fade-out
// so the bubble can animate opacity down before unmounting, `visible`
// toggles the CSS transition.
export function useIdlePetThoughts(temperament) {
  const [thought, setThought] = useState(null)
  const [visible, setVisible] = useState(false)
  const poolRef = useRef([])
  const lastKeyRef = useRef(null)
  const scheduleTimeoutRef = useRef(null)
  const hideTimeoutRef = useRef(null)
  const unmountTimeoutRef = useRef(null)
  const fadeInFrameRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    poolRef.current = []

    if (!temperament) return undefined

    getPetThoughts(temperament).then((thoughts) => {
      if (!cancelled) poolRef.current = thoughts
    })

    return () => {
      cancelled = true
    }
  }, [temperament])

  useEffect(() => {
    const scheduleNext = () => {
      scheduleTimeoutRef.current = setTimeout(() => {
        const pool = poolRef.current
        if (pool.length === 0) {
          scheduleNext()
          return
        }

        const candidates = pool.length > 1
          ? pool.filter((candidate) => candidate.key !== lastKeyRef.current)
          : pool
        const next = candidates[Math.floor(Math.random() * candidates.length)]
        lastKeyRef.current = next.key

        setThought(next)
        setVisible(false)
        fadeInFrameRef.current = requestAnimationFrame(() => setVisible(true))

        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false)
          unmountTimeoutRef.current = setTimeout(() => {
            setThought(null)
            scheduleNext()
          }, FADE_MS)
        }, VISIBLE_DURATION_MS)
      }, randomDelay())
    }

    scheduleNext()

    return () => {
      clearTimeout(scheduleTimeoutRef.current)
      clearTimeout(hideTimeoutRef.current)
      clearTimeout(unmountTimeoutRef.current)
      cancelAnimationFrame(fadeInFrameRef.current)
    }
  }, [])

  return { text: thought?.text ?? null, visible }
}
