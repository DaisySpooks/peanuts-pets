import AquariumBackground from './AquariumBackground.jsx'

// Brief state shown while checking whether the signed-in user already has a
// saved pet. Matches the login/create-pet visual language.
export default function PetLoadingScreen({ error, onRetry }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-10 text-cream">
      <AquariumBackground />
      <div className="relative text-center">
        <p role="status" className="text-sm italic text-gold/60">
          {error ? 'Could not load your pet.' : 'Loading your pet…'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-xl border border-gold/30 bg-cream/5 px-4 py-2 text-sm text-cream transition hover:border-gold/50 hover:bg-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  )
}
