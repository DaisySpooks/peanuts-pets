import { useEffect, useState } from 'react'
import { deleteMyPetAdmin, getAdminPets, getAdminSummary, resetMyPetCooldowns, updateMyPetAdmin } from '../adminApi.js'
import { PET_OPTIONS } from '../petOptions.js'
import { ADMIN_SELECTABLE_COLOURS } from '../petColourOptions.js'
import PetPreview from './PetPreview.jsx'
import {
  PERSONALITY_PREVIEW_LEVELS,
  PERSONALITY_PREVIEW_TEMPERAMENTS,
  buildPersonalityPreviewQueue,
  createPersonalityPreviewActions,
  resolvePersonalityPreviewRuntimeToken,
  resolvePersonalityPreviewUnlock,
} from '../personalityPreview.js'

const MAX_NAME_LENGTH = 20

function formatTimestamp(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function StatLine({ label, value }) {
  return (
    <span className="rounded-lg border border-cream/10 bg-cream/[0.03] px-2 py-1 text-xs text-cream/70">
      {label}: {value}
    </span>
  )
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-3xl border border-gold/20 bg-gradient-to-b from-[#1c1916] to-[#141210] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-cream">{title}</h2>
        {description ? <p className="mt-1 text-sm text-cream/55">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function upsertPetInList(existingPets, nextPet, discordUserId) {
  const petWithDiscordUserId = { ...nextPet, discordUserId }
  const existingIndex = existingPets.findIndex((pet) => pet.discordUserId === discordUserId)

  if (existingIndex === -1) {
    return [petWithDiscordUserId, ...existingPets]
  }

  return existingPets.map((pet, index) => (index === existingIndex ? petWithDiscordUserId : pet))
}

function updateSummaryFromPet(existingSummary, previousPet, nextPet, discordUserId) {
  if (!existingSummary) return existingSummary

  const countByType = { ...existingSummary.countByType }
  if (previousPet?.petType && Object.hasOwn(countByType, previousPet.petType)) {
    countByType[previousPet.petType] = Math.max(0, countByType[previousPet.petType] - 1)
  }
  if (nextPet?.petType && Object.hasOwn(countByType, nextPet.petType)) {
    countByType[nextPet.petType] += 1
  }

  return {
    ...existingSummary,
    countByType,
    recentPets: upsertPetInList(existingSummary.recentPets || [], nextPet, discordUserId).slice(0, 10),
  }
}

export default function AdminScreen({
  currentDiscordUserId,
  myPet,
  onMyPetChange,
  onMyPetDelete,
  onBack,
  onPreviewCelebration,
  onPreviewRuntime,
  onPreviewQueue,
}) {
  const [summary, setSummary] = useState(null)
  const [pets, setPets] = useState([])
  const [petsFilter, setPetsFilter] = useState('')
  const [petType, setPetType] = useState(myPet?.petType || PET_OPTIONS[0].key)
  const [petName, setPetName] = useState(myPet?.petName || '')
  const [petColour, setPetColour] = useState(myPet?.colour || null)
  const [simulateHours, setSimulateHours] = useState('24')
  const [statusMessage, setStatusMessage] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingPets, setIsRefreshingPets] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewTemperament, setPreviewTemperament] = useState('playful')
  const [previewLevel, setPreviewLevel] = useState(1)

  useEffect(() => {
    setPetType(myPet?.petType || PET_OPTIONS[0].key)
    setPetName(myPet?.petName || '')
    setPetColour(myPet?.colour || null)
  }, [myPet])

  function applyUpdatedPetLocally(updatedPet) {
    onMyPetChange?.(updatedPet)

    if (currentDiscordUserId) {
      setSummary((currentSummary) => updateSummaryFromPet(currentSummary, myPet, updatedPet, currentDiscordUserId))

      const normalizedFilter = petsFilter.trim()
      if (!normalizedFilter || normalizedFilter === currentDiscordUserId) {
        setPets((currentPets) => upsertPetInList(currentPets, updatedPet, currentDiscordUserId))
      }
    }
  }

  const previewActions = createPersonalityPreviewActions({
    onCelebration: onPreviewCelebration,
    onRuntime: onPreviewRuntime,
    onQueue: onPreviewQueue,
  })

  const previewUnlock = resolvePersonalityPreviewUnlock(previewTemperament, previewLevel)
  const previewRuntimeToken = resolvePersonalityPreviewRuntimeToken({
    species: myPet?.petType,
    temperament: previewTemperament,
    level: previewLevel,
  })

  function handlePreviewCelebration() {
    if (!myPet || !previewUnlock) return
    previewActions.previewCelebration({ pet: myPet, unlock: previewUnlock })
  }

  function handlePreviewRuntime() {
    if (!myPet || !previewUnlock || !previewRuntimeToken) return
    previewActions.previewRuntime({ token: previewRuntimeToken })
  }

  function handlePreviewQueue() {
    if (!myPet) return
    const queue = buildPersonalityPreviewQueue({ pet: myPet, temperament: previewTemperament, level: previewLevel })
    if (queue.length > 0) previewActions.previewQueue(queue)
  }

  async function refreshSummary() {
    const nextSummary = await getAdminSummary()
    setSummary(nextSummary)
  }

  async function refreshPets(filterValue = petsFilter) {
    const nextPets = await getAdminPets({ discordUserId: filterValue.trim(), limit: 25 })
    setPets(nextPets)
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([getAdminSummary(), getAdminPets({ limit: 25 })])
      .then(([nextSummary, nextPets]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setPets(nextPets)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Could not load admin data right now.')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Returns whether the update actually succeeded, so callers that need to
  // revert optimistic local state (see handleColourChange) don't have to
  // read back the errorMessage state, which wouldn't reflect this call's
  // outcome inside the same closure until the next render.
  const applyPetUpdate = async (label, task) => {
    setIsSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const updatedPet = await task()
      if (updatedPet === null) {
        onMyPetDelete?.()
        setStatusMessage('No pet found for this admin account.')
        return true
      }
      applyUpdatedPetLocally(updatedPet)
      setStatusMessage(label)
      return true
    } catch (error) {
      if (error.status === 404) {
        onMyPetDelete?.()
        setStatusMessage('No pet found for this admin account.')
        return true
      }
      setStatusMessage(null)
      setErrorMessage('Could not save that admin change.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveIdentity = async (event) => {
    event.preventDefault()
    await applyPetUpdate('Saved your pet testing changes.', () =>
      updateMyPetAdmin({ petType, name: petName.trim() }),
    )
  }

  // Saves immediately on selection (no separate submit) so the persisted
  // colour and the live preview below update together as soon as an admin
  // picks a swatch — no new pet, no page reload. Optimistically shows the
  // picked colour right away and reverts it if the save actually failed.
  const handleColourChange = async (event) => {
    const nextColour = event.target.value
    const previousColour = petColour
    setPetColour(nextColour)
    const succeeded = await applyPetUpdate('Updated pet colour.', () => updateMyPetAdmin({ colour: nextColour }))
    if (!succeeded) {
      setPetColour(previousColour)
    }
  }

  const handleStatsPreset = async (statPreset) => {
    const requiresConfirm = statPreset === 'default'
    if (requiresConfirm && !window.confirm('Reset your pet stats back to the default values?')) {
      return
    }

    const label = statPreset === 'low'
      ? 'Set pet stats low.'
      : statPreset === 'high'
        ? 'Set pet stats high.'
        : 'Reset pet stats to defaults.'

    await applyPetUpdate(label, () => updateMyPetAdmin({ statPreset }))
  }

  const handleClearTimestamps = async () => {
    await applyPetUpdate('Cleared action and petting timestamps and made them available.', () =>
      resetMyPetCooldowns(),
    )
  }

  const handleResetAffection = async () => {
    await applyPetUpdate('Reset affection to 0.', () => updateMyPetAdmin({ resetAffection: true }))
  }

  const handleSimulateElapsed = async (event) => {
    event.preventDefault()
    const hours = Number(simulateHours)
    if (!Number.isFinite(hours) || hours <= 0) {
      setStatusMessage(null)
      setErrorMessage('Enter a positive number of hours to simulate.')
      return
    }

    await applyPetUpdate(`Simulated ${hours}h of passive decay.`, () =>
      updateMyPetAdmin({ simulateElapsedHours: hours }),
    )
  }

  const handleDeletePet = async () => {
    if (!window.confirm('Delete your current test pet and return this account to Create Pet?')) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deleteMyPetAdmin()
      onMyPetDelete?.()
      setStatusMessage('Deleted your test pet.')
      await Promise.all([refreshSummary(), refreshPets()])
    } catch (error) {
      if (error.status === 404) {
        onMyPetDelete?.()
        setStatusMessage('No pet found for this admin account.')
        await Promise.all([refreshSummary(), refreshPets()])
      } else {
        setStatusMessage(null)
        setErrorMessage('Could not delete that pet right now.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshPets = async (event) => {
    event.preventDefault()
    setIsRefreshingPets(true)
    setErrorMessage(null)
    try {
      await refreshPets()
    } catch {
      setErrorMessage('Could not refresh the pet list right now.')
    } finally {
      setIsRefreshingPets(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink px-4 py-6 text-cream">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold/70">Peanut&rsquo;s Pets Admin</p>
            <h1 className="mt-2 text-2xl font-semibold text-cream">Testing Panel</h1>
            <p className="mt-1 text-sm text-cream/55">
              Private tools for approved admin and team accounts only.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-gold/30 bg-[#171513] px-4 py-2 text-sm text-cream transition hover:border-gold/60 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Back to Habitat
          </button>
        </header>

        {statusMessage ? (
          <p className="mb-4 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl border border-gold/20 bg-[#171513] px-5 py-6 text-sm text-cream/60">
            Loading admin tools…
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <SectionCard title="Pet Summary" description="Overview of saved pets plus the most recent entries.">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-4">
                    <p className="text-xs uppercase tracking-wide text-cream/45">Total pets</p>
                    <p className="mt-2 text-2xl font-semibold text-cream">{summary?.totalPets ?? 0}</p>
                  </div>
                  {PET_OPTIONS.map((option) => (
                    <div key={option.key} className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-4">
                      <p className="text-xs uppercase tracking-wide text-cream/45">{option.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-cream">
                        {summary?.countByType?.[option.key] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {(summary?.recentPets || []).map((pet) => (
                    <article key={`${pet.discordUserId}-${pet.createdAt}`} className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-cream">{pet.petName}</p>
                          <p className="text-xs text-cream/50">{pet.petType} • Discord {pet.discordUserId}</p>
                        </div>
                        <p className="text-xs text-cream/40">Created {formatTimestamp(pet.createdAt)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatLine label="Hunger" value={pet.hunger} />
                        <StatLine label="Cleanliness" value={pet.cleanliness} />
                        <StatLine label="Happiness" value={pet.happiness} />
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-cream/55 sm:grid-cols-3">
                        <p>Feed: {formatTimestamp(pet.lastFeedAt)}</p>
                        <p>Clean: {formatTimestamp(pet.lastCleanAt)}</p>
                        <p>Play: {formatTimestamp(pet.lastPlayAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Pet Lookup" description="Inspect pets without touching Supabase directly.">
                <form onSubmit={handleRefreshPets} className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    value={petsFilter}
                    onChange={(event) => setPetsFilter(event.target.value)}
                    placeholder="Filter by Discord user ID"
                    className="min-w-[14rem] flex-1 rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
                  />
                  <button
                    type="submit"
                    disabled={isRefreshingPets}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      isRefreshingPets
                        ? 'cursor-not-allowed bg-cream/5 text-cream/30'
                        : 'bg-gradient-to-b from-gold to-[#b8933f] text-ink hover:brightness-110'
                    }`}
                  >
                    {isRefreshingPets ? 'Refreshing…' : 'Refresh'}
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {pets.length === 0 ? (
                    <p className="rounded-2xl border border-cream/10 bg-cream/[0.03] px-4 py-3 text-sm text-cream/55">
                      No pets matched that filter.
                    </p>
                  ) : (
                    pets.map((pet) => (
                      <article key={`${pet.discordUserId}-${pet.createdAt}-${pet.updatedAt}`} className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-cream">{pet.petName}</p>
                            <p className="text-xs text-cream/50">{pet.petType} • Discord {pet.discordUserId}</p>
                          </div>
                          <p className="text-xs text-cream/40">Updated {formatTimestamp(pet.updatedAt)}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatLine label="Hunger" value={pet.hunger} />
                          <StatLine label="Cleanliness" value={pet.cleanliness} />
                          <StatLine label="Happiness" value={pet.happiness} />
                        </div>
                        <div className="mt-3 grid gap-1 text-xs text-cream/55 sm:grid-cols-3">
                          <p>Feed: {formatTimestamp(pet.lastFeedAt)}</p>
                          <p>Clean: {formatTimestamp(pet.lastCleanAt)}</p>
                          <p>Play: {formatTimestamp(pet.lastPlayAt)}</p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="space-y-5">
              <SectionCard title="Test My Pet" description="Changes only affect the currently signed-in admin account.">
                {myPet ? (
                  <>
                    <div className="mb-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
                      <p className="text-sm font-semibold text-cream">Personality Testing</p>
                      <p className="mt-1 text-xs text-cream/55">
                        Manual previews only. These controls are non-persistent and use the loaded pet species ({myPet.petType}).
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-gold/70">
                          Temperament
                          <select
                            value={previewTemperament}
                            onChange={(event) => setPreviewTemperament(event.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm capitalize text-cream focus:outline-none focus:ring-2 focus:ring-gold/50"
                          >
                            {PERSONALITY_PREVIEW_TEMPERAMENTS.map((temperament) => (
                              <option key={temperament} value={temperament} className="bg-[#171513]">
                                {temperament}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-medium uppercase tracking-wide text-gold/70">
                          Milestone
                          <select
                            value={previewLevel}
                            onChange={(event) => setPreviewLevel(Number(event.target.value))}
                            className="mt-1.5 w-full rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-gold/50"
                          >
                            {PERSONALITY_PREVIEW_LEVELS.map((level) => (
                              <option key={level} value={level} className="bg-[#171513]">
                                Level {level}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <p className="mt-3 text-xs text-cream/50">
                        {previewUnlock ? `${previewUnlock.displayName} — ${previewRuntimeToken || 'no animation for this species'}` : 'Unsupported selection.'}
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <button type="button" disabled={!previewUnlock} onClick={handlePreviewCelebration} className="rounded-xl border border-cream/15 bg-cream/[0.03] px-3 py-2.5 text-xs font-semibold text-cream transition hover:border-gold/40 hover:bg-cream/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
                          Preview Celebration (non-persistent)
                        </button>
                        <button type="button" disabled={!previewRuntimeToken} onClick={handlePreviewRuntime} className="rounded-xl border border-cream/15 bg-cream/[0.03] px-3 py-2.5 text-xs font-semibold text-cream transition hover:border-gold/40 hover:bg-cream/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
                          Preview Runtime Behaviour (non-persistent)
                        </button>
                        <button type="button" disabled={!previewUnlock} onClick={handlePreviewQueue} className="rounded-xl border border-cream/15 bg-cream/[0.03] px-3 py-2.5 text-xs font-semibold text-cream transition hover:border-gold/40 hover:bg-cream/[0.06] disabled:cursor-not-allowed disabled:opacity-40">
                          Preview Catch-Up Queue (non-persistent)
                        </button>
                      </div>
                    </div>
                    <form onSubmit={handleSaveIdentity}>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gold/70" htmlFor="admin-pet-type">
                        Pet type
                      </label>
                      <select
                        id="admin-pet-type"
                        value={petType}
                        onChange={(event) => setPetType(event.target.value)}
                        className="w-full rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-gold/50"
                      >
                        {PET_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key} className="bg-[#171513]">
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-gold/70" htmlFor="admin-pet-name">
                        Pet name
                      </label>
                      <input
                        id="admin-pet-name"
                        type="text"
                        value={petName}
                        maxLength={MAX_NAME_LENGTH}
                        onChange={(event) => setPetName(event.target.value)}
                        className="w-full rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
                      />

                      <button
                        type="submit"
                        disabled={isSaving || petName.trim().length === 0}
                        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                          isSaving || petName.trim().length === 0
                            ? 'cursor-not-allowed bg-cream/5 text-cream/30'
                            : 'bg-gradient-to-b from-gold to-[#b8933f] text-ink hover:brightness-110'
                        }`}
                      >
                        Save pet type and name
                      </button>
                    </form>

                    <div className="mt-5 rounded-2xl border border-cream/10 bg-cream/[0.03] p-4">
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gold/70">
                        Colour (testing only)
                      </p>
                      <p className="mb-3 text-xs text-cream/50">
                        Includes orange, which is reserved for a future Nutshell release and never assigned to
                        real players.
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 shrink-0">
                          <PetPreview species={myPet.petType} colour={petColour} />
                        </div>
                        <label className="sr-only" htmlFor="admin-pet-colour">
                          Colour
                        </label>
                        <select
                          id="admin-pet-colour"
                          value={petColour || ''}
                          disabled={isSaving}
                          onChange={handleColourChange}
                          className="w-full rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm capitalize text-cream focus:outline-none focus:ring-2 focus:ring-gold/50"
                        >
                          {(ADMIN_SELECTABLE_COLOURS[myPet.petType] || []).map((colourOption) => (
                            <option key={colourOption} value={colourOption} className="bg-[#171513]">
                              {colourOption}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatsPreset('default')}
                        className="rounded-xl border border-cream/15 bg-cream/[0.03] px-4 py-3 text-sm text-cream transition hover:border-gold/40 hover:bg-cream/[0.06]"
                      >
                        Reset stats
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatsPreset('low')}
                        className="rounded-xl border border-cream/15 bg-cream/[0.03] px-4 py-3 text-sm text-cream transition hover:border-gold/40 hover:bg-cream/[0.06]"
                      >
                        Set stats low
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatsPreset('high')}
                        className="rounded-xl border border-cream/15 bg-cream/[0.03] px-4 py-3 text-sm text-cream transition hover:border-gold/40 hover:bg-cream/[0.06]"
                      >
                        Set stats high
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleClearTimestamps}
                        className="rounded-xl border border-cream/15 bg-cream/[0.03] px-4 py-3 text-sm text-cream transition hover:border-gold/40 hover:bg-cream/[0.06]"
                      >
                        Clear action timestamps
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleResetAffection}
                        className="rounded-xl border border-cream/15 bg-cream/[0.03] px-4 py-3 text-sm text-cream transition hover:border-gold/40 hover:bg-cream/[0.06]"
                      >
                        Reset affection
                      </button>
                    </div>

                    <form onSubmit={handleSimulateElapsed} className="mt-5 flex flex-wrap items-end gap-3">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gold/70" htmlFor="admin-simulate-hours">
                          Simulate elapsed hours (decay test)
                        </label>
                        <input
                          id="admin-simulate-hours"
                          type="number"
                          min="1"
                          value={simulateHours}
                          onChange={(event) => setSimulateHours(event.target.value)}
                          className="w-full rounded-xl border border-cream/15 bg-cream/5 px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-xl border border-cream/15 bg-cream/[0.03] px-4 py-3 text-sm text-cream transition hover:border-gold/40 hover:bg-cream/[0.06]"
                      >
                        Apply decay
                      </button>
                    </form>

                    <div className="mt-4 rounded-2xl border border-cream/10 bg-cream/[0.03] p-4 text-sm text-cream/60">
                      <p>Current pet: {myPet.petName} ({myPet.petType}, {myPet.colour || 'no colour set'})</p>
                      <p className="mt-2">Feed available after: {formatTimestamp(myPet.lastFeedAt)}</p>
                      <p>Clean available after: {formatTimestamp(myPet.lastCleanAt)}</p>
                      <p>Play available after: {formatTimestamp(myPet.lastPlayAt)}</p>
                      <p>Petting available after: {formatTimestamp(myPet.lastPettedAt)}</p>
                      <p className="mt-2">Affection: {myPet.affection}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleDeletePet}
                      className="mt-5 w-full rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15"
                    >
                      Delete/reset my test pet
                    </button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-cream/10 bg-cream/[0.03] px-4 py-4 text-sm text-cream/60">
                    This admin account does not currently have a pet. Go back to Habitat to use Create Pet.
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
