// Small idle-thought bubble anchored near the top of the tank, above the
// pet. Purely decorative/non-interactive (pointer-events-none) so it can
// never block the feed/clean/play controls, which live entirely outside
// TankStage. Fade is driven by the `visible` opacity toggle from
// useIdlePetThoughts — this component just renders whatever text it's given.
export default function PetThoughtBubble({ text, visible }) {
  if (!text) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[7%] z-20 w-[70%] max-w-[15rem] -translate-x-1/2 transition-opacity duration-[400ms] ease-out sm:w-auto"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="relative rounded-2xl border border-gold/25 bg-cream/95 px-3 py-1.5 text-center text-[11px] leading-snug text-ink shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] sm:text-xs">
        {text}
        <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-gold/25 bg-cream/95" />
      </div>
    </div>
  )
}
