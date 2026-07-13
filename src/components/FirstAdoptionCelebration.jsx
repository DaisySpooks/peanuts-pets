import { useEffect, useState } from 'react'
import PetRig from './PetRig.jsx'
import { playAffection } from '../lib/audio.js'
import { PET_EXPRESSIONS } from './useTemporaryExpression.js'

const TOTAL_DURATION_MS = 2900
const FADE_OUT_DURATION_MS = 550
const FADE_OUT_DELAY_MS = TOTAL_DURATION_MS - FADE_OUT_DURATION_MS
const GREETING_DURATION_MS = 900
const GREETING_DELAY_MS = FADE_OUT_DELAY_MS - 300

function buildCelebrationStats(pet) {
  return {
    hunger: Number.isFinite(pet?.hunger) ? pet.hunger : 100,
    cleanliness: Number.isFinite(pet?.cleanliness) ? pet.cleanliness : 100,
    happiness: Number.isFinite(pet?.happiness) ? pet.happiness : 100,
    affection: Number.isFinite(pet?.affection) ? pet.affection : 0,
  }
}

export default function FirstAdoptionCelebration({ pet, onComplete }) {
  const [isExiting, setIsExiting] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)

  useEffect(() => {
    playAffection()

    const greetingTimer = setTimeout(() => setShowGreeting(true), GREETING_DELAY_MS)
    const exitTimer = setTimeout(() => setIsExiting(true), FADE_OUT_DELAY_MS)
    const completeTimer = setTimeout(() => onComplete?.(), TOTAL_DURATION_MS)

    return () => {
      clearTimeout(greetingTimer)
      clearTimeout(exitTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-[80] transition-opacity ${
        isExiting ? 'opacity-0 duration-[550ms]' : 'opacity-100 duration-300'
      }`}
    >
      <div
        className="absolute inset-0 transition-[background-color,backdrop-filter] duration-[550ms]"
        style={{
          backgroundColor: isExiting ? 'rgba(14, 11, 9, 0.06)' : 'rgba(14, 11, 9, 0.26)',
          backdropFilter: isExiting ? 'blur(0px)' : 'blur(14px)',
          WebkitBackdropFilter: isExiting ? 'blur(0px)' : 'blur(14px)',
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[550ms]"
        style={{
          opacity: isExiting ? 0.18 : 1,
          background:
            'radial-gradient(ellipse at center, rgba(82,147,141,0.10) 0%, rgba(82,147,141,0.04) 34%, rgba(14,11,9,0) 68%)',
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[550ms]"
        style={{
          opacity: isExiting ? 0 : 1,
          background:
            'radial-gradient(120% 90% at 50% 44%, transparent 40%, rgba(0,0,0,0.28) 100%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 text-cream sm:px-5 sm:py-8">
        <div className="flex w-full max-w-6xl flex-col items-center justify-center">
          <div className="text-center">
            <p className="text-[1rem] font-medium leading-tight text-cream/88 sm:text-[1.1rem] md:text-[1.2rem]">
              ✨ A new friend has entered the Reserve.
            </p>
            <p className="mt-2 text-[0.78rem] font-semibold tracking-[0.08em] text-gold/86 sm:text-[0.82rem]">
              🥜 20 Nutshells spent
            </p>
          </div>

          <div className="relative mx-auto mt-4 flex aspect-[4/3] w-full max-w-[62rem] items-center justify-center sm:mt-5 md:mt-6">
            <div className="absolute inset-[20%] rounded-full bg-[radial-gradient(circle,rgba(201,164,76,0.24)_0%,rgba(95,167,160,0.18)_34%,rgba(95,167,160,0)_72%)] blur-3xl sm:blur-[72px]" />
            <div className="absolute inset-x-[37%] bottom-[10%] h-[7%] rounded-[999px] bg-black/38 blur-2xl sm:bottom-[12%] sm:h-[8%]" />
            <span className="absolute bottom-[24%] left-[35%] h-3 w-3 rounded-full border border-cream/35 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:0s]" />
            <span className="absolute bottom-[20%] left-[43%] h-2 w-2 rounded-full border border-cream/30 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:0.5s]" />
            <span className="absolute bottom-[25%] right-[35%] h-2.5 w-2.5 rounded-full border border-cream/35 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:1.1s]" />
            <span className="absolute bottom-[21%] right-[43%] h-1.5 w-1.5 rounded-full border border-cream/30 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:1.7s]" />

            <div className="relative h-full w-full overflow-visible">
              <PetRig
                species={pet?.petType}
                colour={pet?.colour ?? null}
                name={pet?.petName ?? 'Your pet'}
                mood="happy"
                stats={buildCelebrationStats(pet)}
                expression={PET_EXPRESSIONS.happy}
                presentationMode="celebration"
                celebrationGreeting={showGreeting}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
