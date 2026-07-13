import TankDecor from './TankDecor.jsx'
import TankEffects from './TankEffects.jsx'
import PetRig from './PetRig.jsx'
import PetShadow from './PetShadow.jsx'
import PetThoughtBubble from './PetThoughtBubble.jsx'

// Maps the cleanliness stat to how visible the dirty-water overlay is.
// Anchored so opacity only reaches exactly 0 at cleanliness === 100 (never
// earlier), and interpolated linearly between anchors instead of stepped —
// so the overlay's own value is continuous and never has to "jump" to
// reflect a stat change. Deliberately the ONLY thing that decides this
// overlay's opacity: nothing else (like the Clean action's in-progress
// state) is allowed to override it, so the visible grime can never show a
// level cleaner than the actual stat, even for a moment.
const DIRT_OPACITY_ANCHORS = [
  { cleanliness: 0, opacity: 0.7 },
  { cleanliness: 20, opacity: 0.5 },
  { cleanliness: 40, opacity: 0.3 },
  { cleanliness: 60, opacity: 0.15 },
  { cleanliness: 80, opacity: 0.05 },
  { cleanliness: 100, opacity: 0 },
]

function getDirtyWaterOpacity(cleanliness) {
  if (typeof cleanliness !== 'number') return 0
  const clamped = Math.max(0, Math.min(100, cleanliness))

  for (let i = 0; i < DIRT_OPACITY_ANCHORS.length - 1; i++) {
    const from = DIRT_OPACITY_ANCHORS[i]
    const to = DIRT_OPACITY_ANCHORS[i + 1]
    if (clamped <= to.cleanliness) {
      const t = (clamped - from.cleanliness) / (to.cleanliness - from.cleanliness)
      return from.opacity + (to.opacity - from.opacity) * t
    }
  }
  return 0
}

// Sparkle positions (within the waterBox), stagger delays, and size for
// the Clean-action wipe effect — display only, no gameplay meaning.
const CLEAN_SPARKLES = [
  { left: '18%', top: '30%', delayMs: 0, sizePx: 10 },
  { left: '38%', top: '55%', delayMs: 120, sizePx: 8 },
  { left: '55%', top: '25%', delayMs: 240, sizePx: 11 },
  { left: '70%', top: '48%', delayMs: 90, sizePx: 7 },
  { left: '85%', top: '32%', delayMs: 200, sizePx: 9 },
]

// One-shot Clean-action feedback, scoped to this file only. Deliberately
// separate from the grime overlay itself (which is driven purely by
// getDirtyWaterOpacity above) — these are a light sweep across the glass
// and a brief overall water brightening, both of which fade back out on
// their own regardless of what the grime overlay is doing.
const CLEAN_FEEDBACK_KEYFRAMES = `
@keyframes clean-wipe-sweep {
  0% { transform: translateX(-130%) skewX(-12deg); opacity: 0; }
  12% { opacity: 0.5; }
  55% { opacity: 0.3; }
  100% { transform: translateX(230%) skewX(-12deg); opacity: 0; }
}
@keyframes clean-brighten {
  0%, 100% { opacity: 0; }
  25% { opacity: 0.18; }
  70% { opacity: 0.07; }
}
`

// The tank "frame": glass, water, reflections, layout container.
// Composes decor/effects/pet but never reaches into PetRenderer's internals.
export default function TankStage({ species, colour, name, lastPettedAt, expression, mood, stats, isEating, isFeeding, feedTrigger, isCleaning, isPlaying, onPetPersist, thoughtText, thoughtVisible }) {
  // Always the real stat-derived value — never forced to 0 during the Clean
  // action. The existing transition-opacity below animates smoothly from
  // whatever the overlay's current opacity is to this new target the moment
  // `stats.cleanliness` updates, so it settles at the correct level with no
  // dishonest dip and no fade-back-in afterward.
  const dirtyWaterOpacity = getDirtyWaterOpacity(stats?.cleanliness)

  return (
    <div className="relative mx-auto aspect-[3/2] max-h-[34vh] w-full max-w-xl overflow-hidden rounded-3xl border-2 border-gold/25 bg-gradient-to-b from-[#385F5C] via-[#284542] to-[#182E2C] shadow-[0_0_0_1px_rgba(201,164,76,0.10),0_16px_38px_-14px_rgba(0,0,0,0.5)] sm:aspect-[16/10] md:aspect-[16/7] md:h-full md:max-h-[640px] md:w-auto md:max-w-full">
      <style>{CLEAN_FEEDBACK_KEYFRAMES}</style>
      <img
        src="/assets/peanuts-pets-tank/water.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      <img
        src="/assets/peanuts-pets-tank/tank.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {/* canvasBox: matches water.png's full rendered (object-contain) bounds */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 aspect-[16/7]">
        {/* waterBox: the actual non-transparent water fill inside that canvas,
            measured directly from water.png's pixel alpha (x 4.96%-95.15%, y 16.89%-84.68%).
            Bubbles/shimmer are clipped here so they never spill into the letterbox
            bars or the opaque wood lid/base painted by tank.png. */}
        <div
          className="absolute overflow-hidden"
          style={{ left: '4.96%', top: '16.89%', width: '90.19%', height: '67.79%' }}
        >
          <TankEffects />
        </div>
      </div>
      <TankDecor />
      <PetShadow mood={mood} isFeeding={isFeeding} isPlaying={isPlaying} />
      <PetThoughtBubble text={thoughtText} visible={thoughtVisible} />
      <PetRig
        species={species}
        colour={colour}
        name={name}
        lastPettedAt={lastPettedAt}
        expression={expression}
        mood={mood}
        stats={stats}
        isEating={isEating}
        isFeeding={isFeeding}
        feedTrigger={feedTrigger}
        isCleaning={isCleaning}
        isPlaying={isPlaying}
        onPetPersist={onPetPersist}
      />
      {/* dirty-water overlay: same full-canvas object-contain box as water.png/tank.png
          so it stays pixel-aligned with them on every breakpoint. Sits above the pet
          and decor so grime visibly affects the whole tank; opacity is driven by the
          cleanliness stat and is display-only for now. */}
      <img
        src="/assets/peanuts-pets-tank/water-dirty.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
        style={{ opacity: dirtyWaterOpacity }}
      />
      {/* Clean-action feedback: a brief light sweep, a soft overall water
          brightening, and a few staggered sparkles — all layered ON TOP of
          the dirty-water overlay above (never hiding or resetting it). Each
          is a one-shot animation that fades itself back out on its own; the
          grime overlay underneath is completely unaffected by any of this
          and just keeps transitioning toward its real target opacity. */}
      {isCleaning && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 aspect-[16/7]">
          <div className="absolute overflow-hidden" style={{ left: '4.96%', top: '16.89%', width: '90.19%', height: '67.79%' }}>
            {/* slight temporary water brightening. `forwards` is required:
                this animation (1300ms) finishes before isCleaning unmounts
                it (1500ms), and without `forwards` the browser reverts to
                the un-animated base style — a fully opaque bg-cream
                rectangle — for that leftover window, which is exactly the
                "white rectangular block" artifact. `forwards` holds the
                keyframe's own final opacity:0 instead. */}
            <div
              className="absolute inset-0 bg-cream"
              style={{ animation: 'clean-brighten 1300ms ease-in-out 1 forwards' }}
            />
            {/* Brief soft wipe / light sweep. Same `forwards` fix as above —
                without it, once the 1100ms animation completes it snaps
                back to this element's untransformed, full-opacity resting
                position instead of staying faded out. The gradient itself
                is defined inline (not via the Tailwind from/via/to
                utility) so there's extra fully-transparent buffer on both
                sides of the bright core, well past where the visible
                streak actually fades out — same peak brightness/position/
                timing as before, just more feathering margin baked in. */}
            <div
              className="absolute inset-y-0 -left-1/3 w-1/3"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, transparent 0%, transparent 22%, rgba(243,236,221,0.7) 50%, transparent 78%, transparent 100%)',
                animation: 'clean-wipe-sweep 1100ms ease-out 1 forwards',
              }}
            />
            {CLEAN_SPARKLES.map((sparkle, index) => (
              <span
                key={index}
                className="absolute flex items-center justify-center leading-none text-cream/90 animate-clean-sparkle"
                style={{
                  left: sparkle.left,
                  top: sparkle.top,
                  fontSize: `${sparkle.sizePx}px`,
                  animationDelay: `${sparkle.delayMs}ms`,
                }}
              >
                ✦
              </span>
            ))}
          </div>
        </div>
      )}
      {/* glass polish: diagonal sheen, edge highlights, corner depth tint —
          all static, low-opacity, purely cosmetic. Sits above the pet/decor
          like a pane of glass but never obscures them. */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl overflow-hidden">
        {/* soft diagonal reflection, upper-left */}
        <div className="absolute -left-1/4 -top-1/3 h-2/3 w-1/2 rotate-[-18deg] bg-gradient-to-b from-cream/[0.10] via-cream/[0.03] to-transparent" />
        {/* Faint highlight along the inside left/right edges, brightest near
            the top where light enters and fading smoothly downward. Built
            from several overlapping radial "glow" pools anchored to the
            edge at different heights and radii — each one's own falloff is
            a smooth radial curve (no linear stop to create a visible band),
            and they're deliberately irregular/overlapping rather than one
            gradient, so the sum has no single identifiable boundary. The
            box is much wider than any glow actually reaches and the whole
            thing is blurred again on top, so nothing terminates at a
            container edge either. */}
        <div
          className="absolute inset-y-0 left-0 w-[20%] blur-[10px]"
          style={{
            backgroundImage: [
              'radial-gradient(60% 22% at 0% 4%, rgba(243,236,221,0.09), transparent 72%)',
              'radial-gradient(55% 26% at 2% 16%, rgba(243,236,221,0.055), transparent 74%)',
              'radial-gradient(50% 30% at 0% 34%, rgba(243,236,221,0.035), transparent 76%)',
              'radial-gradient(45% 34% at 1% 58%, rgba(243,236,221,0.02), transparent 78%)',
              'radial-gradient(45% 30% at 0% 84%, rgba(243,236,221,0.012), transparent 80%)',
            ].join(', '),
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[20%] blur-[10px]"
          style={{
            backgroundImage: [
              'radial-gradient(60% 22% at 100% 3%, rgba(243,236,221,0.07), transparent 72%)',
              'radial-gradient(55% 26% at 98% 15%, rgba(243,236,221,0.042), transparent 74%)',
              'radial-gradient(50% 30% at 100% 33%, rgba(243,236,221,0.026), transparent 76%)',
              'radial-gradient(45% 34% at 99% 57%, rgba(243,236,221,0.015), transparent 78%)',
              'radial-gradient(45% 30% at 100% 83%, rgba(243,236,221,0.009), transparent 80%)',
            ].join(', '),
          }}
        />
        {/* Tiny corner refraction glints where the glass actually curves,
            closest to the light source — soft radial pools (not a clipped
            shape) so there's no traceable outline, just a very faint
            brightening of the corner. */}
        <div
          className="absolute left-0 top-0 h-[30%] w-[22%] blur-[8px]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 0% 0%, rgba(243,236,221,0.10) 0%, rgba(243,236,221,0.04) 40%, rgba(243,236,221,0.012) 65%, transparent 82%)',
          }}
        />
        <div
          className="absolute right-0 top-0 h-[30%] w-[22%] blur-[8px]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 100% 0%, rgba(243,236,221,0.08) 0%, rgba(243,236,221,0.032) 40%, rgba(243,236,221,0.01) 65%, transparent 82%)',
          }}
        />
        {/* subtle darker tint in the lower corners for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.11),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.11),transparent_40%)]" />
      </div>
      {/* glass rim highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-cream/[0.06]" />
    </div>
  )
}
