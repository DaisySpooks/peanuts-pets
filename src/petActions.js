const PET_ACTION_CONFIG = {
  feed: { label: 'Feed', timestampKey: 'lastFeedAt', cooldownMs: 2 * 60 * 60 * 1000 },
  clean: { label: 'Clean', timestampKey: 'lastCleanAt', cooldownMs: 3 * 60 * 60 * 1000 },
  play: { label: 'Play', timestampKey: 'lastPlayAt', cooldownMs: 4 * 60 * 60 * 1000 },
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

  return Object.entries(PET_ACTION_CONFIG).map(([key, config]) => {
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
}
