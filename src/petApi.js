function buildApiError(data, response, fallbackError) {
  const error = new Error(data.error || fallbackError)
  error.status = response.status
  error.code = typeof data.code === 'string' ? data.code : null
  error.balance = Number.isFinite(data.balance) ? data.balance : null
  error.pointDisplayName = typeof data.pointDisplayName === 'string' ? data.pointDisplayName : null
  error.apiError = typeof data.error === 'string' ? data.error : fallbackError
  return error
}

// Frontend boundary for the pet-persistence API. Never sends a Discord user
// id — the server identifies the owner from the signed session cookie only.
export async function getMyPet() {
  const response = await fetch('/api/pets/me', { credentials: 'include' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw buildApiError(data, response, `pet_lookup_failed_${response.status}`)
  }
  const data = await response.json()
  return data.pet
}

export async function createPet({ petType, name }) {
  const response = await fetch('/api/pets/create', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ petType, name }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw buildApiError(data, response, `pet_create_failed_${response.status}`)
  }
  const data = await response.json()
  return data.pet
}

export async function performPetAction(action) {
  const response = await fetch(`/api/pets/${action}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw buildApiError(data, response, `pet_action_failed_${response.status}`)
  }
  const data = await response.json()
  return data.pet
}

export async function performPetting() {
  const response = await fetch('/api/pets/pet', {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw buildApiError(data, response, `petting_failed_${response.status}`)
  }
  const data = await response.json()
  return data.pet
}
