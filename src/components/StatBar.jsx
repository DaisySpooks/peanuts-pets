// Decorative only — the stat label text already conveys the meaning, so
// these are aria-hidden and keyed off the same `stat.key` the app already
// uses everywhere else (mockData.js, App.jsx). Falls back gracefully for
// any future stat key that doesn't have a dedicated icon yet.
const STAT_ICONS = {
  hunger: '🍖',
  cleanliness: '🫧',
  happiness: '💛',
}

export default function StatBar({ stats }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#7a4f22] bg-gradient-to-b from-[#5f4a34] via-[#42321f] to-[#2c2014] p-4 shadow-[0_22px_44px_-16px_rgba(10,6,2,0.75),0_8px_16px_-6px_rgba(10,6,2,0.6),inset_0_1px_0_rgba(255,224,170,0.16),inset_0_-3px_6px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-[#c9a44c]/15 transition-transform duration-300 ease-out hover:-translate-y-px">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f5d38f]/60 to-transparent" />
      <h2 className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-[#f5d38f] [text-shadow:0_1px_1px_rgba(0,0,0,0.5),0_0_10px_rgba(240,200,120,0.15)]">
        <span aria-hidden="true" className="text-[#c9a44c]/70">✦</span>
        Companion Status
        <span aria-hidden="true" className="text-[#c9a44c]/70">✦</span>
      </h2>
      <div className="mb-3 h-px bg-gradient-to-r from-transparent via-[#c9a44c]/60 to-transparent" />
      <div className="flex flex-col gap-2.5">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="flex flex-col gap-1.5 rounded-lg bg-[#241a10]/70 px-2.5 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 text-cream/95">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-[#c9a44c]/30 bg-black/30 text-xs leading-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                >
                  {STAT_ICONS[stat.key] || '⭐'}
                </span>
                {stat.label}
              </span>
              <span className="tabular-nums text-[#e6c48f]">{stat.value}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-black/60 bg-[#120c07] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]">
              <div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#7a531c] via-[#cf9c4d] to-[#f9dc9c] shadow-[inset_0_1px_2px_rgba(255,240,205,0.5),inset_0_-2px_3px_rgba(70,42,10,0.55)] transition-[width] duration-200 ease-out"
                style={{ width: `${stat.value}%` }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/45 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-1.5 rounded-full bg-white/30 blur-[1px]" />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/60 to-transparent animate-bar-sheen" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
