import { useEffect, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import CreatePetScreen from './components/CreatePetScreen.jsx'
import HabitatScreen from './components/HabitatScreen.jsx'
import PetLoadingScreen from './components/PetLoadingScreen.jsx'
import AdminScreen from './components/AdminScreen.jsx'
import { useAuthStatus } from './auth/useAuthStatus.js'
import { getMyPet, performPetAction } from './petApi.js'
import { PET_OPTIONS } from './petOptions.js'
import { defaultStats } from './mockData.js'
import { buildPetActions } from './petActions.js'

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
  const { isCheckingAccess, accessGranted, access, session } = useAuthStatus()
  const [viewingAccessScreen, setViewingAccessScreen] = useState(false)
  const [viewingAdminScreen, setViewingAdminScreen] = useState(false)
  // undefined = not checked yet, null = checked, none saved, object = saved pet.
  const [pet, setPet] = useState(undefined)
  const [petLoadError, setPetLoadError] = useState(false)
  const [petReloadKey, setPetReloadKey] = useState(0)

  const hasAccess = accessGranted && !isCheckingAccess && !viewingAccessScreen
  const hasAdminAccess = access?.adminAccessGranted === true

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

  if (viewingAdminScreen && hasAdminAccess) {
    return (
      <AdminScreen
        currentDiscordUserId={session?.user?.id || null}
        myPet={pet && !petLoadError ? pet : null}
        onMyPetChange={(nextPet) => {
          setPet(nextPet)
          setPetLoadError(false)
        }}
        onMyPetDelete={() => {
          setPet(null)
          setPetLoadError(false)
        }}
        onBack={() => setViewingAdminScreen(false)}
      />
    )
  }

  if (pet === undefined || petLoadError) {
    return (
      <>
        {hasAdminAccess ? (
          <button
            type="button"
            onClick={() => setViewingAdminScreen(true)}
            className="fixed right-4 top-4 z-50 rounded-xl border border-gold/30 bg-[#171513] px-3 py-2 text-sm text-cream transition hover:border-gold/60 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Admin
          </button>
        ) : null}
        <PetLoadingScreen error={petLoadError} onRetry={() => setPetReloadKey((value) => value + 1)} />
      </>
    )
  }

  if (pet === null) {
    return (
      <>
        {hasAdminAccess ? (
          <button
            type="button"
            onClick={() => setViewingAdminScreen(true)}
            className="fixed right-4 top-4 z-50 rounded-xl border border-gold/30 bg-[#171513] px-3 py-2 text-sm text-cream transition hover:border-gold/60 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Admin
          </button>
        ) : null}
        <CreatePetScreen
          onCreate={setPet}
          onViewAccessScreen={() => setViewingAccessScreen(true)}
        />
      </>
    )
  }

  const speciesLabel = PET_OPTIONS.find((p) => p.key === pet.petType)?.label || pet.petType
  const habitatStats = buildHabitatStats(pet)
  const habitatActions = buildPetActions(pet)
  return (
    <>
      {hasAdminAccess ? (
        <button
          type="button"
          onClick={() => setViewingAdminScreen(true)}
          className="fixed right-4 top-4 z-50 rounded-xl border border-gold/30 bg-[#171513] px-3 py-2 text-sm text-cream transition hover:border-gold/60 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          Admin
        </button>
      ) : null}
      <HabitatScreen
        pet={{ name: pet.petName, species: speciesLabel }}
        petType={pet.petType}
        stats={habitatStats}
        actions={habitatActions}
        onActionPersist={async (action) => {
          const updatedPet = await performPetAction(action)
          setPet(updatedPet)
        }}
      />
    </>
  )
}
