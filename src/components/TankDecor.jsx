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
  { file: 'plants-left.png', originPct: '18.9% 79%', animation: 'plant-sway-left 7.5s ease-in-out 0s infinite' },
  { file: 'plants-right.png', originPct: '81.7% 77.6%', animation: 'plant-sway-right 9.2s ease-in-out 1.4s infinite' },
]

const PLANT_SWAY_KEYFRAMES = `
@keyframes plant-sway-left {
  0%, 100% { transform: rotate(-1deg) translateX(-0.5px); }
  50% { transform: rotate(1deg) translateX(0.5px); }
}
@keyframes plant-sway-right {
  0%, 100% { transform: rotate(1.3deg) translateX(0.6px); }
  50% { transform: rotate(-1.3deg) translateX(-0.6px); }
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

        {ROCK_SHADOWS.map((shadow, index) => (
          <div
            key={index}
            className="absolute rounded-full bg-black/40 blur-sm"
            style={shadow}
          />
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
