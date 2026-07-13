import { useState } from 'react'
import { logout } from '../auth/discordAuth.js'
import { createPet } from '../petApi.js'
import { PET_OPTIONS } from '../petOptions.js'
import AquariumBackground from './AquariumBackground.jsx'
import PetPreview from './PetPreview.jsx'

const MAX_NAME_LENGTH = 20

function formatNutshellLabel(count) {
  return count === 1 ? 'Nutshell' : 'Nutshells'
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4 10-10" />
    </svg>
  )
}

export default function CreatePetScreen({ onCreate, onViewAccessScreen }) {
  const [selectedPet, setSelectedPet] = useState(null)
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const trimmedName = name.trim()
  const nameError = nameTouched && trimmedName.length === 0 ? 'Please enter a name.' : null
  const canSubmit = selectedPet !== null && trimmedName.length > 0 && trimmedName.length <= MAX_NAME_LENGTH
  function getCreateErrorMessage(error) {
    if (!error) return 'Could not save your pet. Please try again.'

    if (error.message === 'insufficient_points') {
      const balance = Number.isFinite(error.balance) ? error.balance : 0
      return `You need 20 Nutshells. You currently have ${balance} ${formatNutshellLabel(balance)}.`
    }
    if (error.message === 'pet_create_in_progress') {
      return 'Your pet is still being created. Please try again in a moment.'
    }
    if (error.message === 'pet_payment_failed') {
      return 'Your pet was created, but payment could not be completed. Please contact the team.'
    }
    if (error.message === 'balance_check_failed') {
      return 'We couldn’t check your Nutshell balance right now. Please try again.'
    }

    return 'Could not save your pet. Please try again.'
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setNameTouched(true)
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const savedPet = await createPet({ petType: selectedPet, name: trimmedName })
      onCreate?.(savedPet)
    } catch (error) {
      setSubmitError({
        message: getCreateErrorMessage(error),
        pointDisplayName: error.pointDisplayName,
      })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-10 text-cream">
      <AquariumBackground />

      <main className="relative w-full max-w-[30rem]">
        <div className="mb-7 text-center md:mb-9">
          <div className="mb-3 flex items-center justify-center gap-3 text-gold/50">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold/40" />
            <p className="text-xs uppercase tracking-[0.28em] text-gold/70">Peanut&rsquo;s Pets</p>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-cream drop-shadow-[0_0_24px_rgba(201,164,76,0.18)] sm:text-3xl md:text-4xl">
            Choose Your First Pet
          </h1>
          <p className="mt-2 text-sm text-cream/60 sm:text-base">
            Pick your starter companion and give them a name.
          </p>
          <p className="mt-2 text-xs text-gold/70 sm:text-sm">
            Your first pet costs 20 Nutshells.
          </p>
        </div>

        <div className="relative rounded-3xl border border-gold/20 bg-gradient-to-b from-[#1c1916] to-[#141210] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] sm:p-8">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cream/15 to-transparent" />

          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {PET_OPTIONS.map((pet) => {
                const isSelected = selectedPet === pet.key
                return (
                  <button
                    key={pet.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedPet(pet.key)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition duration-150 ease-out sm:p-3 ${
                      isSelected
                        ? 'border-gold/60 bg-gold/10 shadow-[0_0_0_1px_rgba(201,164,76,0.35),0_8px_20px_-8px_rgba(201,164,76,0.4)]'
                        : 'border-cream/10 bg-cream/[0.03] hover:border-cream/25 hover:bg-cream/[0.06]'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-ink">
                        <CheckIcon />
                      </span>
                    )}
                    <PetPreview species={pet.key} />
                    <span
                      className={`text-xs font-medium sm:text-sm ${isSelected ? 'text-cream' : 'text-cream/70'}`}
                    >
                      {pet.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6">
              <label htmlFor="pet-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gold/70">
                Name your pet
              </label>
              <input
                id="pet-name"
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="e.g. Mochi"
                aria-invalid={nameError ? 'true' : 'false'}
                aria-describedby="pet-name-hint"
                className={`w-full rounded-xl border bg-cream/5 px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-gold/50 ${
                  nameError ? 'border-rose-300/50' : 'border-cream/15'
                }`}
              />
              <div id="pet-name-hint" className="mt-1.5 flex items-center justify-between text-xs">
                <span className={nameError ? 'text-rose-300/80' : 'text-cream/40'}>
                  {nameError || ' '}
                </span>
                <span className="text-cream/30">
                  {name.length}/{MAX_NAME_LENGTH}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition duration-150 ease-out ${
                canSubmit
                  ? 'bg-gradient-to-b from-gold to-[#b8933f] text-ink shadow-[0_10px_24px_-8px_rgba(201,164,76,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110 hover:shadow-[0_14px_28px_-8px_rgba(201,164,76,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] active:scale-[0.97] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]'
                  : 'cursor-not-allowed bg-cream/5 text-cream/30'
              }`}
            >
              Create My Pet
            </button>
            {submitError ? (
              <p role="status" className="mt-4 text-center text-sm leading-relaxed text-cream/70">
                {submitError.message}
              </p>
            ) : null}
          </form>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs">
          {onViewAccessScreen ? (
            <button
              type="button"
              onClick={onViewAccessScreen}
              className="text-cream/40 underline decoration-cream/20 underline-offset-2 transition hover:text-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
            >
              View access status
            </button>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="text-cream/40 underline decoration-cream/20 underline-offset-2 transition hover:text-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
          >
            Log out
          </button>
        </div>
      </main>
    </div>
  )
}
