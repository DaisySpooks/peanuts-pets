// Ambient animated effects: bubbles, water shimmer, floating motes, and the
// top-of-water light (main glare + swaying rays + drifting caustics).
// Rendered behind the front decor/pet layers so it reads as "in the water".
// The outer bubble span's position/size array and its bubble-rise animation
// (shared tailwind keyframe) are unchanged — only the bubble's own visual
// rendering (nested inner spans) was reworked to look procedural instead of
// a flat filled circle.

// Scoped keyframes local to this file only.
const LOCAL_KEYFRAMES = `
@keyframes ray-sway-a {
  0%, 100% { transform: translateX(-3%) skewX(-10deg); }
  50% { transform: translateX(3%) skewX(-4deg); }
}
@keyframes ray-sway-b {
  0%, 100% { transform: translateX(3%) skewX(8deg); }
  50% { transform: translateX(-3%) skewX(3deg); }
}
@keyframes caustic-drift {
  0% { background-position: 0% 0%, 40% 20%; }
  50% { background-position: 8% 5%, 30% 28%; }
  100% { background-position: 0% 0%, 40% 20%; }
}
@keyframes bubble-wobble {
  0%, 100% { transform: translateX(-1px); }
  50% { transform: translateX(1px); }
}
/* Timed to bubble-rise's own 0-100% cycle (same duration/delay as the
   bubble it's attached to): the bubble spends its early rise low in the
   tank, outside the top-anchored light rays, then catches the light in
   the back half of its climb where the rays actually reach. Stays at 0
   the rest of the time so bubbles outside a beam are entirely unaffected. */
@keyframes bubble-catch-light {
  0%, 52%, 100% { opacity: 0; filter: brightness(1); }
  68%, 78% { opacity: var(--catch-opacity, 0.3); filter: brightness(var(--catch-brightness, 1.2)); }
}
/* Same timing as bubble-catch-light above, but for the bubble's own body
   (which must stay fully visible throughout, just a touch brighter) rather
   than a glow overlay that fades from nothing. */
@keyframes bubble-catch-brighten {
  0%, 52%, 100% { filter: brightness(1); }
  68%, 78% { filter: brightness(var(--catch-brightness, 1.12)); }
}
/* Suspended-particle vertical drift + sway. Runs on its own long, slow,
   linear cycle (each particle's own animation-duration/-delay) so the rise
   is imperceptibly gradual; the gentle side-to-side sway is layered on top
   via a handful of transform-only stops so it doesn't distort the timing of
   the bottom->top climb. Looping back to 0% at the bottom is the "recycle" —
   kept invisible by construction since particle-fade (below) is always at
   opacity 0 at both ends of its own cycle. */
@keyframes particle-rise {
  0% { bottom: -3%; transform: translateX(0); }
  20% { transform: translateX(var(--particle-sway, 2px)); }
  50% { transform: translateX(0); }
  80% { transform: translateX(calc(var(--particle-sway, 2px) * -1)); }
  100% { bottom: 103%; transform: translateX(0); }
}
/* Independent, shorter (8-15s) breathing cycle layered on top of the rise
   above — deliberately not phase-locked to it, so particles brighten and
   dim on their own unrelated rhythm instead of all pulsing in unison. */
@keyframes particle-fade {
  0%, 100% { opacity: 0; }
  50% { opacity: var(--particle-opacity, 0.08); }
}
`

// Suspended particles: tiny, near-weightless motes of dust/plankton
// drifting in the water — distinct from the bubble system above (bubbles
// are buoyant and rise briskly with a visible wobble; these barely move,
// are far fainter, and are meant to read as ambient texture rather than a
// noticeable effect). Built once at module load with randomized-but-stable
// per-particle properties so re-renders never reshuffle their motion.
const SUSPENDED_PARTICLE_COUNT = 20

// A random-ish blob radius (à la the bubbles' own irregular border-radius
// trick below) so each particle reads as an organic speck of dust/plankton
// instead of a perfect, uniform circle.
function randomBlobRadius() {
  const corner = () => Math.round(42 + Math.random() * 16) // 42-58%
  return `${corner()}% ${corner()}% ${corner()}% ${corner()}% / ${corner()}% ${corner()}% ${corner()}% ${corner()}%`
}

function buildSuspendedParticles(count) {
  const particles = []
  for (let i = 0; i < count; i++) {
    particles.push({
      key: i,
      left: `${(2 + Math.random() * 96).toFixed(1)}%`,
      width: +(1 + Math.random() * 2).toFixed(2), // 1-3px
      height: +(1 + Math.random() * 2).toFixed(2), // sized independently of width so it's not a perfect circle
      radius: randomBlobRadius(),
      gradCx: Math.round(42 + Math.random() * 16), // off-center soft core, 42-58%
      gradCy: Math.round(42 + Math.random() * 16),
      swayPx: +(1 + Math.random() * 2).toFixed(2), // 1-3px horizontal sway
      opacityPeak: +(0.03 + Math.random() * 0.05).toFixed(3), // 3-8%, dimmer than before
      riseDuration: +(30 + Math.random() * 25).toFixed(1), // 30-55s: very slow
      riseDelay: +(-Math.random() * 55).toFixed(1), // negative = staggered mid-cycle start
      fadeDuration: +(8 + Math.random() * 7).toFixed(1), // 8-15s
      fadeDelay: +(-Math.random() * 15).toFixed(1),
    })
  }
  return particles
}

const SUSPENDED_PARTICLES = buildSuspendedParticles(SUSPENDED_PARTICLE_COUNT)

export default function TankEffects() {
  // `beam` marks bubbles that rise through one of the two light rays below
  // (ray A spans ~20-46%, ray B spans ~52-74%) so only those catch light;
  // 1 = passes through a beam's center, 0.5 = clips its soft edge.
  const bubbles = [
    { left: '10%', size: 5, delay: '0s', duration: '5s', beam: 0 },
    { left: '22%', size: 10, delay: '1s', duration: '7s', beam: 0.5 },
    { left: '34%', size: 4, delay: '2.5s', duration: '4.5s', beam: 1 },
    { left: '46%', size: 7, delay: '0.5s', duration: '6s', beam: 0.5 },
    { left: '58%', size: 12, delay: '3.2s', duration: '8s', beam: 0.5 },
    { left: '70%', size: 5, delay: '1.8s', duration: '5.5s', beam: 1 },
    { left: '82%', size: 8, delay: '4s', duration: '6.5s', beam: 0.5 },
    { left: '90%', size: 4, delay: '2.2s', duration: '4.8s', beam: 0 },
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
      <style>{LOCAL_KEYFRAMES}</style>

      {/* main top-of-water glare: stays put, doesn't sway or drift */}
      <div className="absolute inset-x-0 top-0 h-2/5 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(243,236,221,0.22),transparent_70%)]" />

      {/* light rays: two soft beams with a slow horizontal sway, as if
          gently refracted by the moving water surface above. Shaped as
          radial ellipses (not flat rectangles) so every edge feathers out
          instead of leaving a hard seam against the surrounding water. */}
      <div
        className="absolute -top-6 left-[20%] h-2/3 w-[26%] origin-top blur-md motion-ambient"
        style={{
          background: 'radial-gradient(ellipse 50% 100% at 50% 0%, rgba(243,236,221,0.22), transparent 72%)',
          animation: 'ray-sway-a 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -top-6 left-[52%] h-3/5 w-[22%] origin-top blur-md motion-ambient"
        style={{
          background: 'radial-gradient(ellipse 50% 100% at 50% 0%, rgba(243,236,221,0.16), transparent 72%)',
          animation: 'ray-sway-b 10s ease-in-out infinite',
        }}
      />

      {/* faint caustic/refraction overlay beneath the surface: two soft
          blobs on a slow drift, low opacity so it barely reads as movement */}
      <div
        className="absolute inset-x-0 top-0 h-3/4 opacity-[0.06] motion-ambient"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(243,236,221,0.9) 0%, transparent 60%), radial-gradient(circle, rgba(243,236,221,0.7) 0%, transparent 55%)',
          backgroundSize: '70% 60%, 55% 50%',
          backgroundRepeat: 'no-repeat',
          animation: 'caustic-drift 22s ease-in-out infinite',
          filter: 'blur(6px)',
        }}
      />

      {/* Suspended particles: rendered beneath the bubbles so they read as
          faint background texture the bubbles rise past, not a competing
          effect. Each has its own rise/fade timing (see
          buildSuspendedParticles), so the field never looks synchronized. */}
      {SUSPENDED_PARTICLES.map((p) => (
        <span
          key={p.key}
          className="absolute motion-ambient"
          style={{
            left: p.left,
            bottom: '-3%',
            width: p.width,
            height: p.height,
            borderRadius: p.radius,
            background: `radial-gradient(circle at ${p.gradCx}% ${p.gradCy}%, rgba(255,255,255,0.9) 0%, rgba(214,235,255,0.55) 50%, rgba(214,235,255,0) 75%)`,
            '--particle-sway': `${p.swayPx}px`,
            '--particle-opacity': p.opacityPeak,
            animation: `particle-rise ${p.riseDuration}s linear ${p.riseDelay}s infinite, particle-fade ${p.fadeDuration}s ease-in-out ${p.fadeDelay}s infinite`,
          }}
        />
      ))}

      {bubbles.map((b, i) => {
        const catchStyle = b.beam
          ? { '--catch-opacity': 0.16 + b.beam * 0.16, '--catch-brightness': 1 + b.beam * 0.22 }
          : undefined

        return (
          <span
            key={i}
            className="absolute animate-bubble-rise motion-ambient"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: b.duration,
              animationDelay: b.delay,
              ...catchStyle,
            }}
          >
            {/* Procedural bubble: brighter upper-left body, thin rim instead of
                a solid fill, a tiny specular fleck, and faint opposite-side
                shading for roundness — all as layered gradients on one
                element, plus a very small wobble so it doesn't rise dead
                straight. Odd/even bubbles get a slightly irregular
                border-radius so they don't all read as identical circles.
                When its lane crosses a ray, it also picks up a barely-there
                brightness pulse (bubble-catch-light) timed to the same
                duration/delay as the rise, so it brightens right as it
                passes through the beam and fades back right after. */}
            <span
              className="absolute inset-0 block motion-ambient"
              style={{
                borderRadius: i % 2 === 0 ? '48% 52% 51% 49% / 52% 48% 53% 47%' : '52% 48% 49% 51% / 47% 53% 48% 52%',
                background: `
                  radial-gradient(circle at 28% 24%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.95) 8%, transparent 16%),
                  radial-gradient(circle at 66% 72%, rgba(15,50,55,0.30) 0%, transparent 58%),
                  radial-gradient(circle at 34% 30%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.14) 55%, rgba(255,255,255,0.05) 80%)
                `,
                border: '1px solid rgba(255,255,255,0.35)',
                boxShadow: 'inset 0 0 2px rgba(255,255,255,0.25)',
                animation: b.beam
                  ? `bubble-wobble ${2.4 + (i % 3) * 0.4}s ease-in-out ${b.delay} infinite, bubble-catch-brighten ${b.duration} ease-in-out ${b.delay} infinite`
                  : `bubble-wobble ${2.4 + (i % 3) * 0.4}s ease-in-out ${b.delay} infinite`,
              }}
            />

            {/* Catches the light as the bubble rises through a ray: a soft
                glow that fades in/out in sync with bubble-rise (same
                duration/delay), timed to the portion of the climb where the
                bubble is actually inside a beam. Skipped for bubbles whose
                lane never crosses a ray. */}
            {b.beam > 0 && (
              <span
                className="absolute block motion-ambient"
                style={{
                  inset: '-35%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)',
                  filter: 'blur(1px)',
                  animation: `bubble-catch-light ${b.duration} ease-in-out ${b.delay} infinite`,
                }}
              />
            )}
          </span>
        )
      })}

      {motes.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-cream/40 animate-mote-drift motion-ambient"
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

      {/* water shimmer sweep: wide, soft, slow-moving light band. Kept faint
          and slow so it reads as ambient caustic light drifting through the
          water, not a periodic glare/flash. */}
      <div className="absolute inset-y-0 -left-2/3 w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-cream/[0.08] md:via-cream/[0.06] to-transparent animate-shimmer-sweep [animation-duration:26s]" />
    </div>
  )
}
