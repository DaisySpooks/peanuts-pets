const PET_ACTION_CONFIG = {
  feed: { label: 'Feed', timestampKey: 'lastFeedAt', cooldownMs: 2 * 60 * 60 * 1000 },
  clean: { label: 'Clean', timestampKey: 'lastCleanAt', cooldownMs: 3 * 60 * 60 * 1000 },
  play: { label: 'Play', timestampKey: 'lastPlayAt', cooldownMs: 4 * 60 * 60 * 1000 },
}

// Treat is built separately from PET_ACTION_CONFIG below: unlike feed/clean/
// play it resets at the UTC calendar-day boundary rather than a fixed
// number of hours after last use, and its card shows a Nutshell cost
// instead of a "Ready" state. Server enforcement is the source of truth
// (see hasGivenTreatToday in server/pets.js); this mirrors the same UTC-day
// comparison purely so the card can disable itself without a round trip.
const TREAT_ICON_SRC = '/assets/food/food-heart-snack.png'
const TREAT_NUTSHELL_COST = 5

function getUtcDateKey(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function hasGivenTreatToday(lastTreatAt, nowMs = Date.now()) {
  if (!lastTreatAt) return false
  const lastTreatMs = new Date(lastTreatAt).getTime()
  if (!Number.isFinite(lastTreatMs)) return false
  return getUtcDateKey(lastTreatMs) === getUtcDateKey(nowMs)
}

function buildTreatAction(pet) {
  if (hasGivenTreatToday(pet?.lastTreatAt)) {
    return {
      key: 'treat',
      label: 'Treat',
      status: 'cooldown',
      iconSrc: TREAT_ICON_SRC,
      unavailableLabel: 'Treat given today',
      readyIn: 'Available tomorrow',
    }
  }

  return {
    key: 'treat',
    label: 'Treat',
    status: 'available',
    iconSrc: TREAT_ICON_SRC,
    availableSubtext: `${TREAT_NUTSHELL_COST} Nutshells`,
  }
}

function formatReadyIn(remainingMs) {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  return `${minutes}m`
}

export function buildPetActions(pet) {
  const now = Date.now()

  const careActions = Object.entries(PET_ACTION_CONFIG).map(([key, config]) => {
    const lastActionAt = pet?.[config.timestampKey]
    if (!lastActionAt) {
      return { key, label: config.label, status: 'available' }
    }

    const lastActionMs = new Date(lastActionAt).getTime()
    if (!Number.isFinite(lastActionMs)) {
      return { key, label: config.label, status: 'available' }
    }

    const remainingMs = config.cooldownMs - (now - lastActionMs)
    if (remainingMs <= 0) {
      return { key, label: config.label, status: 'available' }
    }

    return {
      key,
      label: config.label,
      status: 'cooldown',
      readyIn: formatReadyIn(remainingMs),
    }
  })

  return [...careActions, buildTreatAction(pet)]
}
