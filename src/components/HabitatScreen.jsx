import { useEffect, useRef, useState } from 'react'
import TankStage from './TankStage.jsx'
import StatBar, { AffectionBar, getAffectionDisplay } from './StatBar.jsx'
import ActionCard from './ActionCard.jsx'
import PetIdentityCard, { MobilePetIdentityCard } from './PetIdentityCard.jsx'
import { playFoodDrop, playEating, playTankClean, playPlay } from '../lib/audio.js'
import { PET_EXPRESSIONS, useTemporaryExpression } from './useTemporaryExpression.js'
import { useIdlePetThoughts } from './useIdlePetThoughts.js'

// Pellet sinks toward the mouth over this long (matches the pellet-drop
// animation duration in tailwind.config.js); mouth-eating only kicks in
// near the final stretch of that path, then holds briefly after the
// pellet reaches the mouth before the face reverts.
const PELLET_DURATION_MS = 1800
const EATING_START_MS = Math.round(PELLET_DURATION_MS * 0.72)
const EATING_END_MS = PELLET_DURATION_MS + 300

// The eating sound fires a beat after the bite animation starts (rather
// than in the same instant) — the visual mouth movement reads slightly
// ahead of the audio, and this small extra offset is what actually lines
// the two up perceptually.
const EATING_SOUND_EXTRA_DELAY_MS = 150

const CLEANING_DURATION_MS = 1500

const PLAYING_DURATION_MS = 1400
const HAPPY_EXPRESSION_DURATION_MS = 700
const FEED_HAPPY_EXPRESSION_DURATION_MS = (EATING_END_MS - EATING_START_MS) + HAPPY_EXPRESSION_DURATION_MS

const LOW_CLEANLINESS_THRESHOLD = 40
const HIGH_CLEANLINESS_THRESHOLD = 95
const LOW_HUNGER_THRESHOLD = 40
const SLEEPY_HAPPINESS_THRESHOLD = 30
const HAPPY_HAPPINESS_THRESHOLD = 85

// Active action feedback takes priority over everything else, then urgent
// stat needs (sleepy, hungry, dirty tank), then general mood/default. Sleepy
// is checked before low cleanliness: happiness <= SLEEPY_HAPPINESS_THRESHOLD
// is what actually disables petting (see canPet/isSleepy in the pet rigs),
// and a neglected pet's cleanliness/happiness decay together closely enough
// that both are often low at once — so when both are true, this message
// should name the actual reason petting is unavailable rather than the
// cosmetic dirty-tank state.
function getPetStatusText({ isFeeding, isCleaning, isPlaying, stats }) {
  if (isFeeding) return 'Snack time!'
  if (isCleaning) return 'Tidying up the tank!'
  if (isPlaying) return 'Having fun!'

  const { hunger, cleanliness, happiness } = stats

  if (typeof happiness === 'number' && happiness <= SLEEPY_HAPPINESS_THRESHOLD) {
    return 'Getting sleepy.'
  }
  if (typeof cleanliness === 'number' && cleanliness < LOW_CLEANLINESS_THRESHOLD) {
    return 'Tank could use a tidy.'
  }
  if (typeof hunger === 'number' && hunger < LOW_HUNGER_THRESHOLD) {
    return 'Getting a little hungry.'
  }
  if (typeof happiness === 'number' && happiness >= HAPPY_HAPPINESS_THRESHOLD) {
    return 'Feeling bubbly.'
  }
  if (typeof cleanliness === 'number' && cleanliness >= HIGH_CLEANLINESS_THRESHOLD) {
    return 'So fresh and clean.'
  }

  return 'Just floating.'
}

export default function HabitatScreen({
  pet,
  petType,
  colour,
  stats,
  actions,
  onActionPersist,
  onPetPersist,
  mobileIdentityAuthMenu = null,
}) {
  const statsForMood = Object.fromEntries(stats.map((s) => [s.key, s.value]))
  const careStats = stats.filter((stat) => stat.key !== 'affection')
  const affectionStat = stats.find((stat) => stat.key === 'affection') ?? null
  const [isFeeding, setIsFeeding] = useState(false)
  const [isEating, setIsEating] = useState(false)
  const [feedTrigger, setFeedTrigger] = useState(0)
  const [isCleaning, setIsCleaning] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const { expression, showExpression } = useTemporaryExpression()
  const { text: thoughtText, visible: thoughtVisible } = useIdlePetThoughts(pet.temperament)
  const pelletTimeoutRef = useRef(null)
  const eatingStartTimeoutRef = useRef(null)
  const eatingEndTimeoutRef = useRef(null)
  const eatingSoundTimeoutRef = useRef(null)
  const cleaningTimeoutRef = useRef(null)
  const playingTimeoutRef = useRef(null)
  const statusText = getPetStatusText({ isFeeding, isCleaning, isPlaying, stats: statsForMood })
  const activeActionKey = isFeeding ? 'feed' : isCleaning ? 'clean' : isPlaying ? 'play' : null

  useEffect(() => () => {
    clearTimeout(pelletTimeoutRef.current)
    clearTimeout(eatingStartTimeoutRef.current)
    clearTimeout(eatingEndTimeoutRef.current)
    clearTimeout(eatingSoundTimeoutRef.current)
    clearTimeout(cleaningTimeoutRef.current)
    clearTimeout(playingTimeoutRef.current)
  }, [])

  const handleAction = (actionKey) => {
    if (pendingAction) return

    if (actionKey === 'feed') {
      // Fired before any of the state/timer bookkeeping below so there's
      // nothing sitting in front of it — a percussive "plop" sound reads as
      // out of sync with the pellet if it lags the click at all.
      playFoodDrop()

      clearTimeout(pelletTimeoutRef.current)
      clearTimeout(eatingStartTimeoutRef.current)
      clearTimeout(eatingEndTimeoutRef.current)
      clearTimeout(eatingSoundTimeoutRef.current)

      setIsFeeding(true)
      setIsEating(false)
      setFeedTrigger((n) => n + 1)

      pelletTimeoutRef.current = setTimeout(() => setIsFeeding(false), PELLET_DURATION_MS)
      eatingStartTimeoutRef.current = setTimeout(() => {
        setIsEating(true)
        showExpression(PET_EXPRESSIONS.happy, FEED_HAPPY_EXPRESSION_DURATION_MS)
      }, EATING_START_MS)
      eatingEndTimeoutRef.current = setTimeout(() => setIsEating(false), EATING_END_MS)
      // Sound trails the visual bite by a small extra beat (see
      // EATING_SOUND_EXTRA_DELAY_MS) so it lines up perceptually instead of
      // firing the instant the bite animation starts.
      eatingSoundTimeoutRef.current = setTimeout(
        playEating,
        EATING_START_MS + EATING_SOUND_EXTRA_DELAY_MS,
      )
    } else if (actionKey === 'clean') {
      clearTimeout(cleaningTimeoutRef.current)
      setIsCleaning(true)
      cleaningTimeoutRef.current = setTimeout(() => {
        setIsCleaning(false)
        showExpression(PET_EXPRESSIONS.happy, HAPPY_EXPRESSION_DURATION_MS)
      }, CLEANING_DURATION_MS)
      playTankClean()
    } else if (actionKey === 'play') {
      clearTimeout(playingTimeoutRef.current)
      setIsPlaying(true)
      showExpression(PET_EXPRESSIONS.happy, PLAYING_DURATION_MS)
      playingTimeoutRef.current = setTimeout(() => setIsPlaying(false), PLAYING_DURATION_MS)
      playPlay()
    }

    setPendingAction(actionKey)
    Promise.resolve(onActionPersist?.(actionKey))
      .then(() => {
        setActionError(null)
      })
      .catch(() => {
        setActionError('Could not save that action. Your current stats are unchanged.')
      })
      .finally(() => {
        setPendingAction((current) => (current === actionKey ? null : current))
      })
  }

  const handlePetPersist = () => {
    showExpression(PET_EXPRESSIONS.happy, HAPPY_EXPRESSION_DURATION_MS)
    return onPetPersist?.()
  }

  return (
    <div className="relative min-h-screen bg-ink text-cream md:h-screen md:overflow-hidden">
      {/* Page backdrop only — layered behind all UI, never affects layout.
          Base warm-charcoal gradient, a soft ambient glow centered roughly
          behind the aquarium, an edge vignette, and a near-invisible film
          grain (SVG turbulence) so the background reads as material rather
          than a flat fill. Everything here is intentionally subtle. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #1a1512 0%, #14100d 32%, #0e0b09 62%, #0a0807 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(60% 45% at 50% 30%, rgba(201,164,76,0.07) 0%, rgba(201,164,76,0) 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay">
          <filter id="habitat-bg-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#habitat-bg-grain)" />
        </svg>
      </div>
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col gap-3 px-4 py-4 md:gap-3 md:py-5">
        <header className="flex-none md:hidden">
          <MobilePetIdentityCard
            name={pet.name}
            species={pet.species}
            temperament={pet.temperament}
            authMenuProps={mobileIdentityAuthMenu}
          />
        </header>

        <main
          className="flex flex-1 flex-col gap-3 md:min-h-0 md:gap-3"
        >
          <div className="flex flex-none gap-3 md:grid md:min-h-0 md:flex-1 md:grid-cols-[clamp(11rem,10rem+2vw,12rem)_minmax(0,1fr)] md:items-stretch md:gap-[clamp(0.75rem,1.6vw,1.25rem)]">
            <PetIdentityCard name={pet.name} species={pet.species} temperament={pet.temperament} />

            <div className="relative min-w-0 flex-1 md:min-h-0">
              {/* Grounded shadow + ambient glow behind the aquarium — purely
                  decorative, absolutely positioned so it never affects layout
                  sizing, clipped to nothing so it can bleed past the tank's
                  own rounded edges. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
              >
                <div className="h-[70%] w-[85%] rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(201,164,76,0.10)_0%,rgba(201,164,76,0.04)_45%,transparent_72%)] blur-2xl" />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[8%] bottom-[-6%] -z-10 h-[14%] rounded-[999px] bg-black/55 blur-xl"
              />
              <TankStage
                species={petType}
                colour={colour}
                name={pet.name}
                lastPettedAt={pet.lastPettedAt ?? null}
                expression={expression}
                mood="happy"
                stats={statsForMood}
                isEating={isEating}
                isFeeding={isFeeding}
                feedTrigger={feedTrigger}
                isCleaning={isCleaning}
                isPlaying={isPlaying}
                onPetPersist={handlePetPersist}
                thoughtText={thoughtText}
                thoughtVisible={thoughtVisible}
              />
            </div>
          </div>

          <div className="md:hidden">
            <ActionCard
              actions={actions}
              onAction={handleAction}
              activeKey={activeActionKey}
              pendingKey={pendingAction}
              moodText={statusText}
            />
            {actionError ? (
              <p className="mt-2 px-1 text-xs text-cream/50" role="status">
                {actionError}
              </p>
            ) : null}
          </div>

          <div className="md:hidden">
            <StatBar stats={stats} />
          </div>

          <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-stretch md:gap-3">
            <div className="min-w-0">
              <StatBar stats={careStats} />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div>
                <ActionCard
                  actions={actions}
                  onAction={handleAction}
                  activeKey={activeActionKey}
                  pendingKey={pendingAction}
                  moodText={statusText}
                />
                {actionError ? (
                  <p className="mt-2 px-1 text-xs text-cream/50" role="status">
                    {actionError}
                  </p>
                ) : null}
              </div>

              {affectionStat ? (() => {
                const affectionDisplay = getAffectionDisplay(affectionStat)
                return (
                  <div className="relative flex flex-1 flex-col justify-center overflow-hidden rounded-2xl border border-[#d88ba0]/25 bg-[linear-gradient(180deg,rgba(57,23,31,0.92),rgba(34,16,24,0.9))] px-4 py-3 shadow-[0_16px_30px_-18px_rgba(10,6,2,0.72),inset_0_1px_0_rgba(255,216,228,0.08)]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
                    />
                    <div className="relative flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 font-semibold text-[#ffe4eb]">
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#f0a9bb]/35 bg-black/20 text-sm leading-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                        >
                          💗
                        </span>
                        Affection <span className="font-normal text-[#ffe4eb]/60">· Level {affectionDisplay.level}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[#ffd5df]">{affectionDisplay.progressText}</span>
                    </div>
                    <AffectionBar
                      className="relative mt-3"
                      value={affectionDisplay.progressValue}
                      max={affectionDisplay.progressMax}
                    />
                  </div>
                )
              })() : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
