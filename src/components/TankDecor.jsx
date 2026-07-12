// Static background elements: sand, plants, rock/hide.

// Soft contact shadows where each rock cluster meets the sand, so they read
// as resting on the substrate rather than pasted on top. Positioned as
// percentages of the canvasBox (the PNGs' shared object-contain bounds,
// same 1896x829 / ~16:7 frame used by TankStage), derived from each rock
// layer's actual pixel footprint. Display only, no gameplay meaning.
const ROCK_SHADOWS = [
  { left: '5.5%', top: '75%', width: '17%', height: '7.5%' },
  { left: '17%', top: '73.5%', width: '15%', height: '7%' },
  { left: '75.5%', top: '75.5%', width: '17%', height: '6.5%' },
]

// Same idea, tight to each plant's own base — centered under the sway pivot
// (see PLANTS' originPct below) so the stalk reads as rooted in the sand
// rather than floating just above it. Kept as flat, static ellipses (not
// nested inside the swaying plant container) since a cast shadow shouldn't
// rock back and forth with the stalk above it.
const PLANT_SHADOWS = [
  { left: '12%', top: '76.5%', width: '14%', height: '4.5%' }, // under plants-left (origin 18.9% 79%)
  { left: '75%', top: '75.5%', width: '13%', height: '4.5%' }, // under plants-right (origin 81.7% 77.6%)
]

// Warm, low-opacity, tightly-blurred shadow tone shared by both — a dark
// walnut brown rather than flat black, so it reads as shade cast on sand
// instead of a harsh drop shadow.
const CONTACT_SHADOW_CLASSNAME = 'absolute rounded-full bg-[#1c1006]/25 blur-[3px]'

// Idle plant sway: each plant PNG is one flat image (no separate stem/leaf
// layers), so "bending" it isn't possible — instead each is rotated (plus a
// hair of horizontal drift) around a pivot placed at that plant's own base,
// measured from its real pixel bounds in the 1896x829 canvas. Since the
// pivot sits at the base, the base itself doesn't move at all under
// rotation while the top sways further away from it — the same
// transform-origin-at-the-attachment-point trick already used for the fin
// and flipper wobbles. Distinct durations/delays/amplitudes per plant so
// they drift out of phase with each other, like independent stalks in a
// slow current rather than one rigid gust.
//
// The right plant's positive delay (staggering it out of phase with the
// left one) leaves a window before the animation actually starts. Without
// `backwards`, the element sits untransformed (`transform: none`) for that
// whole window and then snaps straight to the 0% keyframe the instant the
// delay elapses — a one-frame jerk on first activation. `restTransform`
// (equal to the 0% keyframe) plus the `backwards` fill-mode both pin the
// element to that exact pose for the entire pre-start window, so there's
// nothing to snap from.
const PLANTS = [
  {
    file: 'plants-left.png',
    originPct: '18.9% 79%',
    restTransform: 'rotate(-0.6deg) translateX(-0.3px)',
    animation: 'plant-sway-left 5.5s ease-in-out 0s infinite backwards',
  },
  {
    file: 'plants-right.png',
    originPct: '81.7% 77.6%',
    restTransform: 'rotate(0.8deg) translateX(0.35px)',
    animation: 'plant-sway-right 6.5s ease-in-out 1s infinite backwards',
  },
]

const PLANT_SWAY_KEYFRAMES = `
@keyframes plant-sway-left {
  0%, 100% { transform: rotate(-0.6deg) translateX(-0.3px); }
  50% { transform: rotate(0.6deg) translateX(0.3px); }
}
@keyframes plant-sway-right {
  0%, 100% { transform: rotate(0.8deg) translateX(0.35px); }
  50% { transform: rotate(-0.8deg) translateX(-0.35px); }
}
`

// Caustic light patches "projected" onto the substrate — sand, rocks, and
// the lower portion of the plants. Deliberately NOT a top-of-water effect
// (TankEffects already owns that); this one is anchored to the floor band
// of the canvasBox and blended with `soft-light` so it only ever nudges
// existing surface brightness up a little, never washes the tank out.
// Each blob drifts and slowly reshapes its own border-radius (an irregular
// organic blob morphing into another irregular blob) rather than scrolling
// in a straight line, which is what keeps it reading as dappled light
// rather than an obvious moving shape. Long (15-19s), mismatched durations
// per blob so the two never fall into a visible synced rhythm.
const CAUSTIC_KEYFRAMES = `
@keyframes caustic-drift-a {
  0%, 100% { transform: translate(-3%, 2%) scale(1); border-radius: 42% 58% 55% 45% / 48% 42% 58% 52%; }
  33% { transform: translate(4%, -3%) scale(1.1); border-radius: 55% 45% 48% 52% / 55% 48% 52% 45%; }
  66% { transform: translate(-2%, -2%) scale(0.94); border-radius: 48% 52% 45% 55% / 45% 55% 48% 52%; }
}
@keyframes caustic-drift-b {
  0%, 100% { transform: translate(3%, -2%) scale(1); border-radius: 55% 45% 48% 52% / 52% 45% 55% 48%; }
  50% { transform: translate(-4%, 3%) scale(1.08); border-radius: 45% 55% 52% 48% / 48% 52% 45% 55%; }
}
@keyframes caustic-glow {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
`

// Soft, warm-white blobs — opacity is the ONLY thing controlling how strong
// each one reads, and it's capped low (peak alpha 0.04-0.06, i.e. 4-6%)
// specifically so this stays "not consciously noticeable" even at each
// blob's brightest moment. Positioned to spread across the sand/rock band
// rather than stacking in one spot.
const CAUSTIC_BLOBS = [
  { left: '4%', top: '2%', width: '34%', height: '85%', color: 'rgba(243,236,221,0.05)', animation: 'caustic-drift-a 16s ease-in-out infinite, caustic-glow 9s ease-in-out infinite' },
  { left: '36%', top: '10%', width: '30%', height: '75%', color: 'rgba(243,236,221,0.04)', animation: 'caustic-drift-b 19s ease-in-out infinite 2.5s, caustic-glow 11s ease-in-out infinite 1.5s' },
  { left: '66%', top: '0%', width: '32%', height: '82%', color: 'rgba(243,236,221,0.055)', animation: 'caustic-drift-a 18s ease-in-out infinite 4s, caustic-glow 10s ease-in-out infinite 3s' },
]

export default function TankDecor() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{PLANT_SWAY_KEYFRAMES}</style>

      <img
        src="/assets/peanuts-pets-tank/sand.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      {/* canvasBox: same object-contain frame as TankStage's water/tank PNGs,
          used here to anchor both the plant sway pivots and the rock
          contact shadows to real pixel positions regardless of breakpoint
          (the outer container's aspect ratio changes at each breakpoint,
          this inner box always matches the PNGs' own ~16:7 aspect). */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 aspect-[16/7]">
        {PLANTS.map((plant) => (
          <div
            key={plant.file}
            className="absolute inset-0"
            style={{ transformOrigin: plant.originPct, transform: plant.restTransform, animation: plant.animation }}
          >
            <img
              src={`/assets/peanuts-pets-tank/${plant.file}`}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          </div>
        ))}

        {PLANT_SHADOWS.map((shadow, index) => (
          <div key={index} className={CONTACT_SHADOW_CLASSNAME} style={shadow} />
        ))}

        {ROCK_SHADOWS.map((shadow, index) => (
          <div key={index} className={CONTACT_SHADOW_CLASSNAME} style={shadow} />
        ))}
      </div>

      <img
        src="/assets/peanuts-pets-tank/home-rocks-left.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      <img
        src="/assets/peanuts-pets-tank/rocks-right.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      {/* Animated caustic light, projected onto the substrate only (sand,
          rocks, lower plant stalks) — sits above those layers so it reads
          as light falling on them, not a water-column effect. Rendered
          after the rocks/plants (so it paints on top of them) but still
          inside TankDecor, so TankStage's own layering (decor, then
          shadow, then pet) keeps it behind the pet automatically. Uses its
          own canvasBox-aligned wrapper (same aspect-[16/7] frame as the
          plants/shadows above) so the floor band it's confined to lines up
          with the real sand/rocks at every breakpoint, not just the outer
          container's own (breakpoint-varying) aspect ratio. */}
      <style>{CAUSTIC_KEYFRAMES}</style>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 aspect-[16/7] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 overflow-hidden"
          style={{ top: '66%', height: '30%', mixBlendMode: 'soft-light' }}
        >
          {CAUSTIC_BLOBS.map((blob, index) => (
            <div
              key={index}
              className="absolute blur-md"
              style={{
                left: blob.left,
                top: blob.top,
                width: blob.width,
                height: blob.height,
                backgroundColor: blob.color,
                animation: blob.animation,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
