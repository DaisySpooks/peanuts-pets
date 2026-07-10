import { useEffect, useRef, useState } from 'react'
import TankStage from './TankStage.jsx'
import StatBar from './StatBar.jsx'
import ActionCard from './ActionCard.jsx'
import { logout } from '../auth/discordAuth.js'

// Pellet sinks toward the mouth over this long (matches the pellet-drop
// animation duration in tailwind.config.js); mouth-eating only kicks in
// near the final stretch of that path, then holds briefly after the
// pellet reaches the mouth before the face reverts.
const PELLET_DURATION_MS = 1800
const EATING_START_MS = Math.round(PELLET_DURATION_MS * 0.72)
const EATING_END_MS = PELLET_DURATION_MS + 300

const CLEANING_DURATION_MS = 1500

const PLAYING_DURATION_MS = 1400

const LOW_CLEANLINESS_THRESHOLD = 40
const HIGH_CLEANLINESS_THRESHOLD = 95
const LOW_HUNGER_THRESHOLD = 40
const SLEEPY_HAPPINESS_THRESHOLD = 30
const HAPPY_HAPPINESS_THRESHOLD = 85

// Active action feedback takes priority over everything else, then urgent
// stat needs (dirty tank, hungry, sleepy), then general mood/default.
function getPetStatusText({ isFeeding, isCleaning, isPlaying, stats }) {
  if (isFeeding) return 'Snack time!'
  if (isCleaning) return 'Tidying up the tank!'
  if (isPlaying) return 'Having fun!'

  const { hunger, cleanliness, happiness } = stats

  if (typeof cleanliness === 'number' && cleanliness < LOW_CLEANLINESS_THRESHOLD) {
    return 'Tank could use a tidy.'
  }
  if (typeof hunger === 'number' && hunger < LOW_HUNGER_THRESHOLD) {
    return 'Getting a little hungry.'
  }
  if (typeof happiness === 'number' && happiness <= SLEEPY_HAPPINESS_THRESHOLD) {
    return 'Getting sleepy.'
  }
  if (typeof happiness === 'number' && happiness >= HAPPY_HAPPINESS_THRESHOLD) {
    return 'Feeling bubbly.'
  }
  if (typeof cleanliness === 'number' && cleanliness >= HIGH_CLEANLINESS_THRESHOLD) {
    return 'So fresh and clean.'
  }

  return 'Just floating.'
}

export default function HabitatScreen({ pet, petType, stats, actions, onActionPersist }) {
  const statsForMood = Object.fromEntries(stats.map((s) => [s.key, s.value]))
  const [isFeeding, setIsFeeding] = useState(false)
  const [isEating, setIsEating] = useState(false)
  const [feedTrigger, setFeedTrigger] = useState(0)
  const [isCleaning, setIsCleaning] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const pelletTimeoutRef = useRef(null)
  const eatingStartTimeoutRef = useRef(null)
  const eatingEndTimeoutRef = useRef(null)
  const cleaningTimeoutRef = useRef(null)
  const playingTimeoutRef = useRef(null)
  const statusText = getPetStatusText({ isFeeding, isCleaning, isPlaying, stats: statsForMood })
  const activeActionKey = isFeeding ? 'feed' : isCleaning ? 'clean' : isPlaying ? 'play' : null

  useEffect(() => () => {
    clearTimeout(pelletTimeoutRef.current)
    clearTimeout(eatingStartTimeoutRef.current)
    clearTimeout(eatingEndTimeoutRef.current)
    clearTimeout(cleaningTimeoutRef.current)
    clearTimeout(playingTimeoutRef.current)
  }, [])

  const handleAction = (actionKey) => {
    if (pendingAction) return

    if (actionKey === 'feed') {
      clearTimeout(pelletTimeoutRef.current)
      clearTimeout(eatingStartTimeoutRef.current)
      clearTimeout(eatingEndTimeoutRef.current)

      setIsFeeding(true)
      setIsEating(false)
      setFeedTrigger((n) => n + 1)

      pelletTimeoutRef.current = setTimeout(() => setIsFeeding(false), PELLET_DURATION_MS)
      eatingStartTimeoutRef.current = setTimeout(() => setIsEating(true), EATING_START_MS)
      eatingEndTimeoutRef.current = setTimeout(() => setIsEating(false), EATING_END_MS)
    } else if (actionKey === 'clean') {
      clearTimeout(cleaningTimeoutRef.current)
      setIsCleaning(true)
      cleaningTimeoutRef.current = setTimeout(() => setIsCleaning(false), CLEANING_DURATION_MS)
    } else if (actionKey === 'play') {
      clearTimeout(playingTimeoutRef.current)
      setIsPlaying(true)
      playingTimeoutRef.current = setTimeout(() => setIsPlaying(false), PLAYING_DURATION_MS)
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

  return (
    <div className="min-h-screen bg-ink text-cream md:h-screen md:overflow-hidden">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-4 py-4 md:gap-3 md:py-5">
        <header className="flex flex-none items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold/70">Peanut&rsquo;s Pets</p>
            <h1 className="text-xl font-semibold text-cream md:text-2xl">{pet.name}</h1>
            <p className="text-sm text-cream/50">{pet.species}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="h-10 w-10 rounded-full border border-gold/40 bg-[#171513] transition hover:border-gold/70 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink md:h-12 md:w-12"
          />
        </header>

        <main
          className="flex flex-1 flex-col gap-3 md:grid md:min-h-0 md:gap-3"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'minmax(0, 1fr) auto auto',
            gridTemplateAreas: "'tank tank' 'mood mood' 'stats actions'",
          }}
        >
          <div className="flex-none md:min-h-0" style={{ gridArea: 'tank' }}>
            <TankStage
              species={petType}
              name={pet.name}
              mood="happy"
              stats={statsForMood}
              isEating={isEating}
              isFeeding={isFeeding}
              feedTrigger={feedTrigger}
              isCleaning={isCleaning}
              isPlaying={isPlaying}
            />
          </div>

          <div
            className="flex-none rounded-2xl border border-gold/20 bg-[#171513] p-4"
            style={{ gridArea: 'mood' }}
          >
            <p role="status" className="text-sm leading-relaxed text-cream/80">{statusText}</p>
          </div>

          <div className="flex-none" style={{ gridArea: 'actions' }}>
            <ActionCard
              actions={actions}
              onAction={handleAction}
              activeKey={activeActionKey}
              pendingKey={pendingAction}
            />
            {actionError ? (
              <p className="mt-2 px-1 text-xs text-cream/50" role="status">
                {actionError}
              </p>
            ) : null}
          </div>

          <div className="flex-none" style={{ gridArea: 'stats' }}>
            <StatBar stats={stats} />
          </div>
        </main>
      </div>
    </div>
  )
}
