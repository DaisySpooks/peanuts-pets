// Small idle-thought bubble, anchored inside the water just above the pet's
// head (the pet itself is centered at top-[54%] of this same TankStage
// coordinate space — see PetRenderer/BettaRig/TurtleRig). Below `sm` the
// tank uses a shorter aspect-[3/2] box, so top-[22%] there leaves the same
// rough clearance above the pet's head as top-[28%] does on the taller
// sm+/md aspect ratios — both read as "coming from" the pet without ever
// overlapping its body or the tank decor. Purely decorative/non-interactive
// (pointer-events-none) so it can never block the feed/clean/play controls,
// which live entirely outside TankStage. Fade is driven by the `visible`
// opacity toggle from useIdlePetThoughts — this component just renders
// whatever text it's given.
export default function PetThoughtBubble({ text, visible }) {
  if (!text) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[22%] z-20 w-[58%] max-w-[11rem] -translate-x-1/2 transition-opacity duration-[400ms] ease-out sm:top-[28%] sm:max-w-[12rem]"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="relative rounded-[1.25rem] border border-gold/20 px-4 py-2.5 text-center text-[11px] leading-snug text-ink shadow-[0_8px_16px_-9px_rgba(20,12,4,0.4)] sm:text-xs"
        style={{
          background: 'radial-gradient(120% 140% at 50% 15%, rgba(255,247,228,0.98) 0%, rgba(243,236,221,0.95) 55%, rgba(237,222,190,0.92) 100%)',
          boxShadow: '0 0 0 1px rgba(201,164,76,0.08), 0 8px 16px -9px rgba(20,12,4,0.4), 0 0 18px -4px rgba(201,164,76,0.18)',
        }}
      >
        {text}
        <div
          className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-gold/20"
          style={{ background: 'rgba(243,236,221,0.95)' }}
        />
      </div>
    </div>
  )
}
