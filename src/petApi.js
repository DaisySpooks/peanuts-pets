// Frontend boundary for the pet-persistence API. Never sends a Discord user
// id — the server identifies the owner from the signed session cookie only.
export async function getMyPet() {
  const response = await fetch('/api/pets/me', { credentials: 'include' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data.error || `pet_lookup_failed_${response.status}`)
    error.status = response.status
    throw error
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
    const error = new Error(data.error || `pet_create_failed_${response.status}`)
    error.status = response.status
    throw error
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
    const error = new Error(data.error || `pet_action_failed_${response.status}`)
    error.status = response.status
    throw error
  }
  const data = await response.json()
  return data.pet
}
