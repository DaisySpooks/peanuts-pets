import { loginWithDiscord, logout } from '../auth/discordAuth.js'
import { useAuthStatus } from '../auth/useAuthStatus.js'
import AquariumBackground from './AquariumBackground.jsx'

const ACCESS_DENIED_COPY = {
  not_in_server: {
    title: 'No access yet.',
    description: 'Join the Peanut’s Pets Discord server to continue.',
  },
  missing_role: {
    title: 'No access yet.',
    description: 'Your Discord account doesn’t have an approved role yet.',
  },
  discord_unavailable: {
    title: 'Couldn’t verify access.',
    description: 'Discord isn’t responding right now. Please try again shortly.',
  },
  rate_limited: {
    title: 'Couldn’t verify access.',
    description: 'Too many attempts. Please wait a moment and try again.',
  },
}
const DEFAULT_DENIED_COPY = {
  title: 'No access yet.',
  description: 'We couldn’t confirm access for this account.',
}

function DiscordIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
    >
      <path d="M20.32 5.37a19.8 19.8 0 0 0-4.9-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 0 0-5.48 0 12.6 12.6 0 0 0-.62-1.26.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.9 1.52.07.07 0 0 0-.03.03C1.1 9.29.36 13.1.73 16.85a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.07.07 0 0 1 .08 0c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08 0c.12.1.24.19.37.28a.08.08 0 0 1 0 .13 12.3 12.3 0 0 1-1.87.9.08.08 0 0 0-.04.11c.36.7.77 1.36 1.22 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.06c.44-4.34-.74-8.12-3.13-11.45a.06.06 0 0 0-.03-.03ZM8.68 14.6c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm6.65 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 flex-none fill-none stroke-current"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5 5 6v5.5c0 4.4 2.9 7.9 7 9 4.1-1.1 7-4.6 7-9V6l-7-2.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.8 1.8L14.5 10" />
    </svg>
  )
}

export default function LoginScreen({ onReturn }) {
  const { session, access, authError, isAuthenticated, isCheckingAccess, accessGranted } =
    useAuthStatus()

  const handleDiscordLoginClick = () => {
    loginWithDiscord()
  }

  const deniedCopy = isAuthenticated && access && !accessGranted
    ? ACCESS_DENIED_COPY[access.reason] || DEFAULT_DENIED_COPY
    : null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-10 text-cream">
      <AquariumBackground />

      <main className="relative w-full max-w-[26rem]">
        <div className="mb-7 text-center md:mb-9">
          <div className="mb-3 flex items-center justify-center gap-3 text-gold/50">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold/40" />
            <p className="text-xs uppercase tracking-[0.28em] text-gold/70">Peanut&rsquo;s Pets</p>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-cream drop-shadow-[0_0_24px_rgba(201,164,76,0.18)] sm:text-3xl md:text-4xl">
            A new friend has entered The Reserve.
          </h1>
        </div>

        <div className="relative rounded-3xl border border-gold/20 bg-gradient-to-b from-[#1c1916] to-[#141210] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] sm:p-8">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cream/15 to-transparent" />

          {isAuthenticated ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-cream sm:text-base">Discord connected.</p>
              {session.user?.username ? (
                <p className="mt-1 text-xs text-cream/50">Signed in as {session.user.username}</p>
              ) : null}

              {isCheckingAccess ? (
                <p role="status" className="mt-4 text-xs italic text-gold/60">
                  Checking access…
                </p>
              ) : accessGranted ? (
                <p role="status" className="mt-4 text-sm font-semibold text-gold">
                  Access confirmed.
                </p>
              ) : deniedCopy ? (
                <div role="status" className="mt-4">
                  <p className="text-sm font-semibold text-cream/80">{deniedCopy.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/50">
                    {deniedCopy.description}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={logout}
                className="mt-5 text-xs text-cream/40 underline decoration-cream/20 underline-offset-2 transition hover:text-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
              >
                Log out
              </button>
              {accessGranted && onReturn ? (
                <button
                  type="button"
                  onClick={onReturn}
                  className="ml-4 mt-5 text-xs text-cream/40 underline decoration-cream/20 underline-offset-2 transition hover:text-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
                >
                  Back to pet setup
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-center text-sm leading-relaxed text-cream/70 sm:text-base">
                Log in with Discord to meet your Peanut&rsquo;s Pet, care for their habitat, and
                keep them happy.
              </p>

              <button
                type="button"
                onClick={handleDiscordLoginClick}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold to-[#b8933f] px-4 py-3.5 text-sm font-semibold text-ink shadow-[0_10px_24px_-8px_rgba(201,164,76,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-150 ease-out hover:brightness-110 hover:shadow-[0_14px_28px_-8px_rgba(201,164,76,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] active:scale-[0.97] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171513]"
              >
                <DiscordIcon />
                Log in with Discord
              </button>

              <p className="mt-3 text-center text-xs italic text-gold/60">
                Available to verified PP Holders and approved team members.
              </p>

              {authError ? (
                <p role="status" className="mt-3 text-center text-xs text-cream/50">
                  Something went wrong connecting to Discord. Please try again.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-5 flex items-start gap-2 border-t border-cream/10 px-1 pt-4">
          <ShieldIcon />
          <p className="text-[11px] leading-relaxed text-cream/45">
            Peanut&rsquo;s Pets will never ask for your seed phrase, private key, wallet
            signature, or payment information. Access is checked through your Discord role only.
          </p>
        </div>
      </main>
    </div>
  )
}
