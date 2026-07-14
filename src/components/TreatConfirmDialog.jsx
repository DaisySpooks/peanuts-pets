// Confirmation dialog for the Treat action card. There's no existing modal
// component in this codebase to extend (the only prior confirm pattern is
// window.confirm in AdminScreen.jsx) — this follows the fixed-overlay/
// bordered-card visual language used elsewhere (e.g. CreatePetScreen's card,
// FirstAdoptionCelebration's overlay) rather than introducing a new style.
export default function TreatConfirmDialog({
  open,
  petName,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="treat-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-gold/20 bg-gradient-to-b from-[#1c1916] to-[#141210] p-6 text-cream shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cream/15 to-transparent" />

        <h2 id="treat-dialog-title" className="text-lg font-semibold text-cream">
          Give {petName} a treat?
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-cream/70">
          Costs <strong className="font-semibold text-gold">5 Nutshells</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          Your pet will gain <strong className="font-semibold text-[#ffb3c6]">+1 permanent Affection</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          You can give one treat per day.
        </p>

        {errorMessage ? (
          <p role="alert" className="mt-4 text-sm leading-relaxed text-rose-300/90">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition duration-150 ease-out ${
              isSubmitting
                ? 'cursor-not-allowed bg-cream/5 text-cream/30'
                : 'bg-gradient-to-b from-gold to-[#b8933f] text-ink shadow-[0_10px_24px_-8px_rgba(201,164,76,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110 active:scale-[0.97] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]'
            }`}
          >
            {isSubmitting ? 'Giving Treat…' : 'Give Treat'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-cream/15 px-4 py-3 text-sm font-medium text-cream/70 transition hover:border-cream/30 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
