import { useCallback, useEffect, useRef, useState } from 'react'

export const PET_EXPRESSIONS = {
  neutral: 'neutral',
  happy: 'happy',
}

export function useTemporaryExpression(defaultExpression = PET_EXPRESSIONS.neutral) {
  const [expression, setExpression] = useState(defaultExpression)
  const timeoutRef = useRef(null)

  const showExpression = useCallback((nextExpression, durationMs) => {
    clearTimeout(timeoutRef.current)
    setExpression(nextExpression)

    if (typeof durationMs !== 'number' || durationMs <= 0) return

    timeoutRef.current = setTimeout(() => {
      setExpression(defaultExpression)
    }, durationMs)
  }, [defaultExpression])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  return {
    expression,
    showExpression,
  }
}
