function capitalize(text) {
  return text[0].toUpperCase() + text.slice(1)
}

// Desktop-only nameplate for the current pet, shown to the left of the
// aquarium. The chevron switcher is reserved for future multi-pet support —
// there's only ever one pet today, so the controls are rendered disabled
// and non-interactive rather than wired up to do nothing. Width comes from
// its parent grid column (see HabitatScreen), not a fixed class here.
export default function PetIdentityCard({ name, species, temperament }) {
  return (
    <div className="relative hidden overflow-hidden rounded-2xl border-2 border-[#7a4f22] bg-gradient-to-b from-[#5f4a34] via-[#42321f] to-[#2c2014] p-4 shadow-[0_22px_44px_-16px_rgba(10,6,2,0.75),0_8px_16px_-6px_rgba(10,6,2,0.6),inset_0_1px_0_rgba(255,224,170,0.16),inset_0_-3px_6px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-[#c9a44c]/15 md:flex md:w-full md:flex-col md:justify-between">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f5d38f]/60 to-transparent" />

      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4a45a]">Peanut&rsquo;s Pets</p>
        <h1 className="mt-2 break-words text-2xl font-bold leading-tight text-cream [text-shadow:0_1px_1px_rgba(0,0,0,0.5),0_0_10px_rgba(240,200,120,0.12)]">
          {name}
        </h1>
        <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#f0c988]">{species}</p>
        {temperament ? (
          <p className="mt-1 text-xs text-cream/45">{capitalize(temperament)}</p>
        ) : null}
      </div>

      <div className="relative mt-6 flex items-center justify-center gap-3 border-t border-[#c9a44c]/15 pt-3">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#a97845]/25 text-xs leading-none text-[#a8927a]/50"
        >
          ‹
        </span>
        <span className="text-[11px] font-medium tracking-wide text-cream/40">1 of 1</span>
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#a97845]/25 text-xs leading-none text-[#a8927a]/50"
        >
          ›
        </span>
      </div>
    </div>
  )
}

// Compact mobile counterpart to the nameplate above — same color language
// (border/gradient/badge) as the desktop card, reused rather than
// duplicated, but a low-height horizontal layout that sits above the tank
// instead of beside it. Logout/Admin remain their own fixed-position
// controls (see App.jsx AuthControls); this card just reserves right-hand
// padding so its text never sits under them.
export function MobilePetIdentityCard({ name, species, temperament }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#7a4f22] bg-gradient-to-b from-[#5f4a34] via-[#42321f] to-[#2c2014] py-3 pl-3.5 pr-24 shadow-[0_14px_28px_-14px_rgba(10,6,2,0.65),inset_0_1px_0_rgba(255,224,170,0.16)] ring-1 ring-inset ring-[#c9a44c]/15">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#f5d38f]/60 to-transparent" />
      <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4a45a]">Peanut&rsquo;s Pets</p>
      <div className="relative mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h1 className="truncate text-lg font-bold leading-tight text-cream [text-shadow:0_1px_1px_rgba(0,0,0,0.5),0_0_10px_rgba(240,200,120,0.12)]">
          {name}
        </h1>
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#f0c988]">{species}</span>
      </div>
      {temperament ? (
        <p className="relative mt-1 text-[11px] text-cream/45">{capitalize(temperament)}</p>
      ) : null}
    </div>
  )
}
