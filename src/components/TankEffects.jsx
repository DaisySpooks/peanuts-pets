// Ambient animated effects: bubbles, water shimmer, floating motes.
// Rendered behind the front decor/pet layers so it reads as "in the water".
// NOTE: bubbles array/keyframe are approved as-is — do not modify.
export default function TankEffects() {
  const bubbles = [
    { left: '10%', size: 5, delay: '0s', duration: '5s' },
    { left: '22%', size: 10, delay: '1s', duration: '7s' },
    { left: '34%', size: 4, delay: '2.5s', duration: '4.5s' },
    { left: '46%', size: 7, delay: '0.5s', duration: '6s' },
    { left: '58%', size: 12, delay: '3.2s', duration: '8s' },
    { left: '70%', size: 5, delay: '1.8s', duration: '5.5s' },
    { left: '82%', size: 8, delay: '4s', duration: '6.5s' },
    { left: '90%', size: 4, delay: '2.2s', duration: '4.8s' },
  ]

  // Kept to a few clearly-visible spots in open water, away from the pet's
  // central swim lane and clear of the plant/rock decor on both breakpoints.
  const motes = [
    { left: '30%', top: '22%', size: 4, delay: '0s', duration: '9s' },
    { left: '66%', top: '30%', size: 5, delay: '2.5s', duration: '10s' },
    { left: '20%', top: '58%', size: 4, delay: '4.5s', duration: '8.5s' },
  ]

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-cream/45 animate-bubble-rise"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: b.duration,
            animationDelay: b.delay,
          }}
        />
      ))}

      {motes.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-cream/40 animate-mote-drift"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDuration: m.duration,
            animationDelay: m.delay,
          }}
        />
      ))}

      {/* water shimmer sweep: wide, soft, slow-moving light band.
          Mobile reads a touch brighter since the band covers a smaller
          physical tank; desktop is toned down since the same opacity
          spans a much wider, brighter canvas. */}
      <div className="absolute inset-y-0 -left-2/3 w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-cream/[0.30] md:via-cream/[0.24] to-transparent animate-shimmer-sweep" />
    </div>
  )
}
