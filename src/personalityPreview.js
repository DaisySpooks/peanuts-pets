import { getUnlockForTemperamentAndLevel, getUnlocksForTemperament } from '../server/petPersonalityUnlocks.js'
import { getUnlockCelebrationAnimation } from './components/personalityUnlockAnimations.js'
import { buildPersonalityUnlockQueue } from './personalityUnlockQueue.js'

export const PERSONALITY_PREVIEW_TEMPERAMENTS = ['playful', 'curious', 'gentle', 'sleepy', 'foodie']
export const PERSONALITY_PREVIEW_LEVELS = [1, 3, 5, 8, 12]

export function resolvePersonalityPreviewUnlock(temperament, level) {
  if (!PERSONALITY_PREVIEW_TEMPERAMENTS.includes(temperament)) return null
  if (!PERSONALITY_PREVIEW_LEVELS.includes(Number(level))) return null
  return getUnlockForTemperamentAndLevel(temperament, Number(level)) ?? null
}

export function buildPersonalityPreviewQueue({ pet, temperament, level }) {
  if (!pet || !PERSONALITY_PREVIEW_TEMPERAMENTS.includes(temperament)) return []
  const selectedLevel = Number(level)
  if (!PERSONALITY_PREVIEW_LEVELS.includes(selectedLevel)) return []
  const unlocks = getUnlocksForTemperament(temperament)
    .filter((unlock) => unlock.requiredLevel <= selectedLevel)
  return buildPersonalityUnlockQueue(pet, unlocks)
}

export function resolvePersonalityPreviewRuntimeToken({ species, temperament, level }) {
  const unlock = resolvePersonalityPreviewUnlock(temperament, level)
  if (!unlock || typeof species !== 'string') return null
  return getUnlockCelebrationAnimation(unlock.unlockKey, species)
}

// Preview commands are deliberately callback-only: they never receive a
// persistence function and therefore cannot accidentally save test state.
export function createPersonalityPreviewActions({ onCelebration, onRuntime, onQueue } = {}) {
  return {
    previewCelebration: (payload) => onCelebration?.(payload),
    previewRuntime: (payload) => onRuntime?.(payload),
    previewQueue: (payload) => onQueue?.(payload),
  }
}
