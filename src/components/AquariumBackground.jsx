// Shared decorative backdrop (warm/aqua glows, vignette, shimmer, bubbles,
// motes) used behind the full-screen auth and pet-creation screens so they
// share one consistent premium aquarium atmosphere.
export default function AquariumBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* base warmth + water-light layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(120,86,42,0.16),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(46,94,90,0.22),transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_88%,rgba(201,164,76,0.10),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_85%,rgba(46,94,90,0.12),transparent_50%)]" />
      {/* vignette to seat the scene */}
      <div className="absolute inset-0 shadow-[inset_0_0_180px_60px_rgba(0,0,0,0.55)]" />
      {/* soft glow anchor behind the card so it doesn't float in empty space */}
      <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.07] blur-3xl md:h-[560px] md:w-[560px] md:bg-gold/[0.06]" />
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-aqua/[0.10] blur-3xl md:h-[720px] md:w-[720px]" />
      <div className="absolute -inset-x-10 top-1/3 h-40 -rotate-3 bg-gradient-to-r from-transparent via-cream/[0.03] to-transparent animate-shimmer-sweep" />
      <div className="absolute -inset-x-10 top-2/3 h-32 rotate-2 bg-gradient-to-r from-transparent via-gold/[0.04] to-transparent animate-shimmer-sweep [animation-delay:6s]" />
      <span className="absolute bottom-0 left-[12%] h-1.5 w-1.5 rounded-full bg-cream/40 animate-bubble-rise [animation-delay:0s]" />
      <span className="absolute bottom-0 left-[28%] h-1 w-1 rounded-full bg-cream/30 animate-bubble-rise [animation-delay:1.4s]" />
      <span className="absolute bottom-0 left-[65%] h-1.5 w-1.5 rounded-full bg-cream/30 animate-bubble-rise [animation-delay:2.6s]" />
      <span className="absolute bottom-0 left-[82%] h-1 w-1 rounded-full bg-cream/40 animate-bubble-rise [animation-delay:0.8s]" />
      <span className="absolute bottom-0 left-[45%] hidden h-1 w-1 rounded-full bg-cream/30 animate-bubble-rise [animation-delay:3.4s] md:inline-block" />
      <span className="absolute bottom-0 left-[92%] hidden h-1.5 w-1.5 rounded-full bg-cream/30 animate-bubble-rise [animation-delay:1.9s] md:inline-block" />
      <span className="absolute left-[20%] top-[22%] h-1 w-1 rounded-full bg-gold/40 animate-mote-drift" />
      <span className="absolute right-[18%] top-[35%] h-1 w-1 rounded-full bg-gold/30 animate-mote-drift [animation-delay:2s]" />
      <span className="absolute left-[8%] top-[60%] hidden h-1 w-1 rounded-full bg-gold/25 animate-mote-drift [animation-delay:4s] md:inline-block" />
      <span className="absolute right-[10%] top-[68%] hidden h-1 w-1 rounded-full bg-cream/20 animate-mote-drift [animation-delay:1s] md:inline-block" />
    </div>
  )
}
