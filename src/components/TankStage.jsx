import TankDecor from './TankDecor.jsx'
import TankEffects from './TankEffects.jsx'
import PetRig from './PetRig.jsx'
import PetShadow from './PetShadow.jsx'

// Maps the cleanliness stat to how visible the dirty-water overlay is.
function getDirtyWaterOpacity(cleanliness) {
  if (typeof cleanliness !== 'number') return 0
  if (cleanliness >= 80) return 0
  if (cleanliness >= 60) return 0.15
  if (cleanliness >= 40) return 0.3
  if (cleanliness >= 20) return 0.5
  return 0.7
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

// The tank "frame": glass, water, reflections, layout container.
// Composes decor/effects/pet but never reaches into PetRenderer's internals.
export default function TankStage({ species, name, mood, stats, isEating, isFeeding, feedTrigger, isCleaning, isPlaying }) {
  const dirtyWaterOpacity = isCleaning ? 0 : getDirtyWaterOpacity(stats?.cleanliness)

  return (
    <div className="relative mx-auto aspect-[3/2] max-h-[34vh] w-full max-w-xl overflow-hidden rounded-3xl border-4 border-gold/40 bg-gradient-to-b from-[#3E7873] via-[#2E5E5A] to-[#1F4440] shadow-[0_0_0_1px_rgba(201,164,76,0.15),0_20px_50px_-12px_rgba(0,0,0,0.6)] sm:aspect-[16/10] md:aspect-[16/7] md:h-full md:max-h-[640px] md:w-auto md:max-w-full">
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
      <PetRig species={species} name={name} mood={mood} stats={stats} isEating={isEating} isFeeding={isFeeding} feedTrigger={feedTrigger} isPlaying={isPlaying} />
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
      {/* Clean-action feedback: a few staggered sparkles over the waterBox
          while isCleaning is true, on top of the (now-hidden) dirty overlay. */}
      {isCleaning && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 aspect-[16/7]">
          <div className="absolute" style={{ left: '4.96%', top: '16.89%', width: '90.19%', height: '67.79%' }}>
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
        {/* faint vertical highlights along inside left/right edges */}
        <div className="absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-cream/[0.08] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[6%] bg-gradient-to-l from-cream/[0.06] to-transparent" />
        {/* subtle darker tint in the lower corners for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.16),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.16),transparent_35%)]" />
      </div>
      {/* glass rim highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-cream/10" />
    </div>
  )
}
