import { useEffect, useRef, useState } from 'react'

// Generic occasional-blink timer (closed eyes for ~120-180ms on a randomized
// 3-6s interval), shared by the split-face rigs that have separate eyes
// layers (betta). Not used by PetRenderer.jsx (axolotl), which keeps its
// own copy of this logic untouched as the "finished" rig.
const BLINK_MIN_INTERVAL_MS = 3000
const BLINK_MAX_INTERVAL_MS = 6000
const BLINK_MIN_DURATION_MS = 120
const BLINK_MAX_DURATION_MS = 180

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

// minDurationMs/maxDurationMs let a rig shorten the closed-eye hold below
// the default 120-180ms — e.g. turtle has no separate eyelid layer and
// blinks by briefly swapping to its full face-sleepy expression, so its
// blink needs to be quicker than a normal eyelid close to still read as a
// blink instead of a mood change.
export function useIdleBlink(canBlink, {
  minDurationMs = BLINK_MIN_DURATION_MS,
  maxDurationMs = BLINK_MAX_DURATION_MS,
} = {}) {
  const [isBlinking, setIsBlinking] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!canBlink) {
      setIsBlinking(false)
      return undefined
    }

    const scheduleNextBlink = () => {
      timeoutRef.current = setTimeout(() => {
        setIsBlinking(true)
        timeoutRef.current = setTimeout(() => {
          setIsBlinking(false)
          scheduleNextBlink()
        }, randomBetween(minDurationMs, maxDurationMs))
      }, randomBetween(BLINK_MIN_INTERVAL_MS, BLINK_MAX_INTERVAL_MS))
    }

    scheduleNextBlink()
    return () => clearTimeout(timeoutRef.current)
  }, [canBlink, minDurationMs, maxDurationMs])

  return isBlinking
}
