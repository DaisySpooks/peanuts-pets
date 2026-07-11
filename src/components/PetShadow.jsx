// Soft contact shadow cast by the swimming pet onto the sand below it.
// Positioned with the same left-1/2 anchor every pet rig uses, so it stays
// centered under the pet at every breakpoint without needing per-species
// coordinates. Reacts to the pet's own motion instead of sitting static:
//   - idle "happy" bob: pulses size/opacity in sync with animate-pet-bob
//     (same 4s ease-in-out loop), shrinking and fading as the pet rises,
//     the way a cast shadow would as its subject moves further away.
//   - feeding: nudges toward the same lean direction the pet's body takes.
//   - playing: shrinks and fades, matching the pet lifting into its bounce.
export default function PetShadow({ mood, isFeeding, isPlaying }) {
  const pulse = mood === 'happy' && !isFeeding && !isPlaying ? 'animate-pet-shadow-pulse' : ''
  const lean = isFeeding ? 'translate(-4%, 0)' : 'translate(0, 0)'
  const scale = isPlaying ? 0.8 : 1
  const opacity = isPlaying ? 0.3 : 0.46

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[76%] -translate-x-1/2 -translate-y-1/2"
      style={{ transform: `translate(-50%, -50%) ${lean}`, transition: 'transform 500ms ease-out' }}
    >
      <div
        className={`h-[1.3rem] w-[clamp(3.4rem,19%,4.8rem)] rounded-full sm:w-[clamp(3.8rem,17%,5.6rem)] md:w-[clamp(4rem,14%,9.5rem)] ${pulse}`}
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0) 78%)',
          filter: 'blur(2px)',
          transform: `scale(${scale})`,
          opacity,
          transition: 'transform 400ms ease-out, opacity 400ms ease-out',
        }}
      />
    </div>
  )
}
