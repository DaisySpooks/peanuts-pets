// Decorative only — the action label text already conveys the meaning, so
// these are aria-hidden and keyed off the same `action.key` used everywhere
// else (mockData.js, petActions.js). Falls back gracefully for any future
// action key that doesn't have a dedicated icon yet.
const ACTION_ICONS = {
  feed: '🍖',
  clean: '🧼',
  play: '🎾',
}

export default function ActionCard({ actions, onAction, activeKey, pendingKey }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border-2 border-[#7a4f22] bg-gradient-to-b from-[#5f4a34] via-[#42321f] to-[#2c2014] p-4 shadow-[0_22px_44px_-16px_rgba(10,6,2,0.75),0_8px_16px_-6px_rgba(10,6,2,0.6),inset_0_1px_0_rgba(255,224,170,0.16),inset_0_-3px_6px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-[#c9a44c]/15 transition-transform duration-300 ease-out hover:-translate-y-px">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f5d38f]/60 to-transparent" />
      <h2 className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-[#f5d38f] [text-shadow:0_1px_1px_rgba(0,0,0,0.5),0_0_10px_rgba(240,200,120,0.15)]">
        <span aria-hidden="true" className="text-[#c9a44c]/70">✦</span>
        Care Actions
        <span aria-hidden="true" className="text-[#c9a44c]/70">✦</span>
      </h2>
      <div className="mb-3 h-px bg-gradient-to-r from-transparent via-[#c9a44c]/60 to-transparent" />
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => {
          const available = action.status === 'available'
          const hasPendingAction = pendingKey !== null
          const isPending = available && action.key === pendingKey
          const isEnabled = available && !hasPendingAction
          const isActive = available && action.key === activeKey
          const accessibleLabel = isEnabled
            ? `${action.label}, ready${isActive ? ', in progress' : ''}`
            : isPending
              ? `${action.label}, saving`
            : `${action.label}, on cooldown, ready in ${action.readyIn}`
          return (
            <button
              key={action.key}
              type="button"
              disabled={!isEnabled}
              aria-label={accessibleLabel}
              aria-pressed={isActive || undefined}
              onClick={isEnabled ? () => onAction?.(action.key) : undefined}
              className={
                available
                  ? `flex flex-col items-center gap-1 rounded-xl border-2 border-[#7a4f22] bg-gradient-to-b from-[#f9e4b4] via-[#e3b968] to-[#a97535] px-3 py-3.5 text-[#3b2410] shadow-[0_3px_0_rgba(90,52,14,0.65),0_12px_20px_-6px_rgba(40,22,6,0.62),inset_0_2px_0_rgba(255,250,232,0.75),inset_0_-5px_7px_rgba(101,60,17,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_4px_0_rgba(90,52,14,0.65),0_14px_24px_-6px_rgba(40,22,6,0.66),inset_0_2px_0_rgba(255,250,232,0.8),inset_0_-5px_7px_rgba(101,60,17,0.55)] active:translate-y-[3px] active:shadow-[0_0_0_rgba(90,52,14,0.65),inset_0_3px_6px_rgba(60,35,10,0.55)] active:brightness-95 ${
                      isActive ? 'ring-2 ring-[#f5d38f]/70 ring-offset-2 ring-offset-[#2c2014] brightness-105' : ''
                    }`
                  : 'flex cursor-not-allowed flex-col items-center gap-1 rounded-xl border border-black/50 bg-[#1a130b] px-3 py-3.5 text-[#a8927a]/50 opacity-80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)]'
              }
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <span
                  aria-hidden="true"
                  className={
                    available
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs leading-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-xs leading-none'
                  }
                >
                  {ACTION_ICONS[action.key] || '⭐'}
                </span>
                {action.label}
              </span>
              <span className="text-[11px] leading-tight">
                {isPending ? 'Saving…' : available ? 'Ready' : action.readyIn}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
