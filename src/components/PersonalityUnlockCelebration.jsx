import TankStage from './TankStage.jsx'
import { PET_EXPRESSIONS } from './useTemporaryExpression.js'
import { getUnlockCelebrationAnimation } from './personalityUnlockAnimations.js'

// Same stat-fallback shape as FirstAdoptionCelebration's buildCelebrationStats
// — the pet's own stats when available, otherwise a fully-content default so
// the tank never renders a distressed mood during a celebration.
function buildCelebrationStats(pet) {
  return {
    hunger: Number.isFinite(pet?.hunger) ? pet.hunger : 100,
    cleanliness: Number.isFinite(pet?.cleanliness) ? pet.cleanliness : 100,
    happiness: Number.isFinite(pet?.happiness) ? pet.happiness : 100,
    affection: Number.isFinite(pet?.affection) ? pet.affection : 0,
  }
}

// Level 1 personality-unlock celebration. Reuses the same fixed-overlay/
// bordered-card visual language as TreatConfirmDialog, and the pet's normal
// habitat display (TankStage) with its existing happy mood/expression. Which
// (if any) code-driven celebration animation to play is looked up from
// personalityUnlockAnimations.js by unlockKey + species — this component
// never branches on species or unlockKey itself; unsupported unlock/species
// combinations still fall back to the plain happy display.
export default function PersonalityUnlockCelebration({ pet, unlock, onContinue }) {
  if (!unlock) return null

  const celebrationAnimation = getUnlockCelebrationAnimation(unlock.unlockKey, pet?.petType)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="personality-unlock-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-gold/20 bg-gradient-to-b from-[#1c1916] to-[#141210] p-6 text-cream shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cream/15 to-transparent" />

        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-gold/80">
          Personality Unlocked!
        </p>
        <h2 id="personality-unlock-title" className="mt-1 text-center text-xl font-semibold text-cream">
          {unlock.displayName}
        </h2>

        <div className="relative mx-auto mt-4 w-full max-w-sm">
          <TankStage
            species={pet?.petType}
            colour={pet?.colour ?? null}
            name={pet?.petName ?? 'Your pet'}
            lastPettedAt={pet?.lastPettedAt ?? null}
            expression={PET_EXPRESSIONS.happy}
            mood="happy"
            stats={buildCelebrationStats(pet)}
            celebrationAnimation={celebrationAnimation}
          />
        </div>

        <p className="mt-4 text-center text-sm leading-relaxed text-cream/70">
          {unlock.description}
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl bg-gradient-to-b from-gold to-[#b8933f] px-4 py-3 text-sm font-semibold text-ink shadow-[0_10px_24px_-8px_rgba(201,164,76,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-150 ease-out hover:brightness-110 active:scale-[0.97] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
