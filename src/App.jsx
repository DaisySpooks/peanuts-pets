import { useEffect, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import CreatePetScreen from './components/CreatePetScreen.jsx'
import HabitatScreen from './components/HabitatScreen.jsx'
import PetLoadingScreen from './components/PetLoadingScreen.jsx'
import AdminScreen from './components/AdminScreen.jsx'
import FirstAdoptionCelebration from './components/FirstAdoptionCelebration.jsx'
import { MobileFixedAuthMenu } from './components/MobileAuthMenu.jsx'
import { useAuthStatus } from './auth/useAuthStatus.js'
import { logout } from './auth/discordAuth.js'
import { getMyPet, performPetAction, performPetting, performTreat } from './petApi.js'
import { PET_OPTIONS } from './petOptions.js'
import { defaultStats } from './mockData.js'
import { buildPetActions } from './petActions.js'
import { isAudioEnabled, setupAudioLifecycle, toggleAudio } from './lib/audio.js'

// Fixed top-right desktop controls shown across every authenticated screen
// except AdminScreen itself (which has its own nav). Mobile uses a compact
// dropdown trigger instead, but the desktop layout/spacing stays unchanged.
function DesktopAuthControls({ hasAdminAccess, onAdminClick }) {
  const controlButtonClassName =
    'rounded-xl border border-gold/30 bg-[#171513] px-3 py-2 text-sm text-cream transition hover:border-gold/60 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60'
  const [audioEnabled, setAudioEnabledState] = useState(() => isAudioEnabled())

  const handleToggleAudio = () => {
    setAudioEnabledState(toggleAudio())
  }

  return (
    <div className="fixed right-4 top-4 z-50 hidden flex-col items-end gap-2 md:flex">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleAudio}
          aria-label={audioEnabled ? 'Mute audio' : 'Unmute audio'}
          aria-pressed={audioEnabled}
          className={controlButtonClassName}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>
        <button type="button" onClick={logout} className={controlButtonClassName}>
          Logout
        </button>
      </div>
      {hasAdminAccess ? (
        <button type="button" onClick={onAdminClick} className={controlButtonClassName}>
          Admin
        </button>
      ) : null}
    </div>
  )
}

function buildHabitatStats(pet) {
  const persistedValues = {
    hunger: pet?.hunger,
    cleanliness: pet?.cleanliness,
    happiness: pet?.happiness,
    affection: pet?.affection,
  }

  return defaultStats.map((stat) => {
    const nextStat = {
      ...stat,
      value: Number.isFinite(persistedValues[stat.key]) ? persistedValues[stat.key] : stat.value,
    }

    // Level fields are server-derived (see server/petAffectionLevels.js) and
    // only ever attached to the affection stat — older API responses simply
    // won't have them, which the affection display falls back around.
    if (stat.key === 'affection') {
      nextStat.level = pet?.level
      nextStat.levelProgress = pet?.levelProgress
      nextStat.levelProgressRequired = pet?.levelProgressRequired
      nextStat.nextLevelAt = pet?.nextLevelAt
    }

    return nextStat
  })
}

export default function App() {
  const { isCheckingAccess, accessGranted, access, session } = useAuthStatus()
  const [viewingAccessScreen, setViewingAccessScreen] = useState(false)
  const [viewingAdminScreen, setViewingAdminScreen] = useState(false)
  // undefined = not checked yet, null = checked, none saved, object = saved pet.
  const [pet, setPet] = useState(undefined)
  const [petLoadError, setPetLoadError] = useState(null)
  const [petReloadKey, setPetReloadKey] = useState(0)
  const [pendingFirstAdoptionPet, setPendingFirstAdoptionPet] = useState(null)

  const hasAccess = accessGranted && !isCheckingAccess && !viewingAccessScreen
  const hasAdminAccess = access?.adminAccessGranted === true

  useEffect(() => setupAudioLifecycle(), [])

  useEffect(() => {
    if (!hasAccess) return undefined
    let cancelled = false
    setPet(undefined)
    setPetLoadError(null)
    getMyPet()
      .then((result) => {
        if (!cancelled) {
          setPet(result)
          setPetLoadError(null)
        }
      })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401 || error.status === 403) {
          setViewingAccessScreen(true)
          return
        }
        if (error.message === 'pet_payment_failed') {
          setPetLoadError({
            type: 'blocked_payment',
            detail: null,
          })
          return
        }
        if (error.message === 'pet_create_in_progress') {
          setPetLoadError({
            type: 'create_in_progress',
            detail: 'Please try again in a moment.',
          })
          return
        }
        setPetLoadError({
          type: 'generic',
          detail: null,
        })
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
          setPetLoadError(null)
        }}
        onMyPetDelete={() => {
          setPet(null)
          setPetLoadError(null)
        }}
        onBack={() => setViewingAdminScreen(false)}
      />
    )
  }

  if (pet === undefined || petLoadError) {
    const handlePetReload = petLoadError?.type === 'blocked_payment'
      ? undefined
      : () => setPetReloadKey((value) => value + 1)

    return (
      <>
        <DesktopAuthControls hasAdminAccess={hasAdminAccess} onAdminClick={() => setViewingAdminScreen(true)} />
        <MobileFixedAuthMenu hasAdminAccess={hasAdminAccess} onAdminClick={() => setViewingAdminScreen(true)} />
        <PetLoadingScreen error={petLoadError} onRetry={handlePetReload} />
      </>
    )
  }

  if (pet === null) {
    return (
      <>
        <DesktopAuthControls hasAdminAccess={hasAdminAccess} onAdminClick={() => setViewingAdminScreen(true)} />
        <MobileFixedAuthMenu hasAdminAccess={hasAdminAccess} onAdminClick={() => setViewingAdminScreen(true)} />
        <CreatePetScreen
          onCreate={(savedPet) => {
            setPendingFirstAdoptionPet(savedPet)
            setPet(savedPet)
          }}
          onViewAccessScreen={() => setViewingAccessScreen(true)}
        />
      </>
    )
  }

  const speciesLabel = PET_OPTIONS.find((p) => p.key === pet.petType)?.label || pet.petType
  const habitatStats = buildHabitatStats(pet)
  const habitatActions = buildPetActions(pet)
  const habitatScreen = (
    <HabitatScreen
      pet={{
        name: pet.petName,
        species: speciesLabel,
        temperament: pet.temperament ?? null,
        lastPettedAt: pet.lastPettedAt ?? null,
      }}
      petType={pet.petType}
      colour={pet.colour ?? null}
      stats={habitatStats}
      actions={habitatActions}
      mobileIdentityAuthMenu={{
        hasAdminAccess,
        onAdminClick: () => setViewingAdminScreen(true),
      }}
      onActionPersist={async (action) => {
        const updatedPet = await performPetAction(action)
        setPet(updatedPet)
      }}
      onPetPersist={async () => {
        const updatedPet = await performPetting()
        setPet(updatedPet)
        return updatedPet
      }}
      onTreatPersist={async () => {
        const updatedPet = await performTreat()
        setPet(updatedPet)
        return updatedPet
      }}
    />
  )

  if (pendingFirstAdoptionPet) {
    return (
      <div className="relative min-h-screen">
        {habitatScreen}
        <FirstAdoptionCelebration
          pet={pendingFirstAdoptionPet}
          onComplete={() => setPendingFirstAdoptionPet(null)}
        />
      </div>
    )
  }

  return (
    <>
      <DesktopAuthControls hasAdminAccess={hasAdminAccess} onAdminClick={() => setViewingAdminScreen(true)} />
      {habitatScreen}
    </>
  )
}
