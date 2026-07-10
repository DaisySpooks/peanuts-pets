export default function StatBar({ stats }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-[#171513] p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gold/80">Stats</h2>
      <div className="flex flex-col gap-3">
        {stats.map((stat) => (
          <div key={stat.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-cream/90">{stat.label}</span>
              <span className="text-cream/60">{stat.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-cream/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                style={{ width: `${stat.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
