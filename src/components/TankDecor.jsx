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
const PLANTS = [
  { file: 'plants-left.png', originPct: '18.9% 79%', animation: 'plant-sway-left 5.5s ease-in-out 0s infinite' },
  { file: 'plants-right.png', originPct: '81.7% 77.6%', animation: 'plant-sway-right 6.5s ease-in-out 1s infinite' },
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
            style={{ transformOrigin: plant.originPct, animation: plant.animation }}
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
    </div>
  )
}
