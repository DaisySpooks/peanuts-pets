async function readJson(response, fallbackError) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || fallbackError)
    error.status = response.status
    throw error
  }
  return data
}

export async function getAdminSummary() {
  const response = await fetch('/api/admin/summary', { credentials: 'include' })
  return readJson(response, `admin_summary_failed_${response.status}`)
}

export async function getAdminPets({ discordUserId, limit = 25 } = {}) {
  const url = new URL('/api/admin/pets', window.location.origin)
  url.searchParams.set('limit', String(limit))
  if (discordUserId) {
    url.searchParams.set('discordUserId', discordUserId)
  }

  const response = await fetch(url, { credentials: 'include' })
  const data = await readJson(response, `admin_pets_failed_${response.status}`)
  return data.pets
}

export async function updateMyPetAdmin(payload) {
  const response = await fetch('/api/admin/my-pet/update', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await readJson(response, `admin_pet_update_failed_${response.status}`)
  return data.pet
}

export async function resetMyPetCooldowns() {
  const response = await fetch('/api/admin/my-pet/reset-cooldowns', {
    method: 'POST',
    credentials: 'include',
  })
  const data = await readJson(response, `admin_pet_reset_cooldowns_failed_${response.status}`)
  return data.pet
}

export async function deleteMyPetAdmin() {
  const response = await fetch('/api/admin/my-pet', {
    method: 'DELETE',
    credentials: 'include',
  })
  const data = await readJson(response, `admin_pet_delete_failed_${response.status}`)
  return data.pet
}
