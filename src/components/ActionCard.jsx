export default function ActionCard({ actions, onAction, activeKey }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-[#171513] p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gold/80">Actions</h2>
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => {
          const available = action.status === 'available'
          const isActive = available && action.key === activeKey
          const accessibleLabel = available
            ? `${action.label}, ready${isActive ? ', in progress' : ''}`
            : `${action.label}, on cooldown, ready in ${action.readyIn}`
          return (
            <button
              key={action.key}
              type="button"
              disabled={!available}
              aria-label={accessibleLabel}
              aria-pressed={isActive || undefined}
              onClick={available ? () => onAction?.(action.key) : undefined}
              className={
                available
                  ? `flex flex-col items-center gap-1 rounded-xl bg-gold px-3 py-2.5 text-ink shadow-sm transition duration-150 ease-out hover:brightness-110 hover:shadow-md active:scale-[0.97] active:brightness-95 ${
                      isActive ? 'ring-2 ring-cream/70 ring-offset-2 ring-offset-[#171513] brightness-105' : ''
                    }`
                  : 'flex cursor-not-allowed flex-col items-center gap-1 rounded-xl border border-cream/10 bg-cream/5 px-3 py-2.5 text-cream/30 opacity-60 saturate-50'
              }
            >
              <span className="text-sm font-semibold">{action.label}</span>
              <span className="text-[11px] leading-tight">
                {available ? 'Ready' : action.readyIn}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
