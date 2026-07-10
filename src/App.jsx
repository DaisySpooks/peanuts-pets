import { useEffect, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import CreatePetScreen from './components/CreatePetScreen.jsx'
import HabitatScreen from './components/HabitatScreen.jsx'
import PetLoadingScreen from './components/PetLoadingScreen.jsx'
import { useAuthStatus } from './auth/useAuthStatus.js'
import { getMyPet, performPetAction } from './petApi.js'
import { PET_OPTIONS } from './petOptions.js'
import { defaultStats, actions } from './mockData.js'

function buildHabitatStats(pet) {
  const persistedValues = {
    hunger: pet?.hunger,
    cleanliness: pet?.cleanliness,
    happiness: pet?.happiness,
  }

  return defaultStats.map((stat) => ({
    ...stat,
    value: Number.isFinite(persistedValues[stat.key]) ? persistedValues[stat.key] : stat.value,
  }))
}

export default function App() {
  const { isCheckingAccess, accessGranted } = useAuthStatus()
  const [viewingAccessScreen, setViewingAccessScreen] = useState(false)
  // undefined = not checked yet, null = checked, none saved, object = saved pet.
  const [pet, setPet] = useState(undefined)
  const [petLoadError, setPetLoadError] = useState(false)
  const [petReloadKey, setPetReloadKey] = useState(0)

  const hasAccess = accessGranted && !isCheckingAccess && !viewingAccessScreen

  useEffect(() => {
    if (!hasAccess) return undefined
    let cancelled = false
    setPet(undefined)
    setPetLoadError(false)
    getMyPet()
      .then((result) => {
        if (!cancelled) {
          setPet(result)
          setPetLoadError(false)
        }
      })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401 || error.status === 403) {
          setViewingAccessScreen(true)
          return
        }
        setPetLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [hasAccess, petReloadKey])

  if (!hasAccess) {
    return <LoginScreen onReturn={viewingAccessScreen ? () => setViewingAccessScreen(false) : undefined} />
  }

  if (pet === undefined || petLoadError) {
    return <PetLoadingScreen error={petLoadError} onRetry={() => setPetReloadKey((value) => value + 1)} />
  }

  if (pet === null) {
    return (
      <CreatePetScreen
        onCreate={setPet}
        onViewAccessScreen={() => setViewingAccessScreen(true)}
      />
    )
  }

  const speciesLabel = PET_OPTIONS.find((p) => p.key === pet.petType)?.label || pet.petType
  const habitatStats = buildHabitatStats(pet)
  return (
    <HabitatScreen
      pet={{ name: pet.petName, species: speciesLabel }}
      petType={pet.petType}
      stats={habitatStats}
      actions={actions}
      onActionPersist={async (action) => {
        const updatedPet = await performPetAction(action)
        setPet(updatedPet)
      }}
    />
  )
}
