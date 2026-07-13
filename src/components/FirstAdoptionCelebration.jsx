import { useEffect, useState } from 'react'
import AquariumBackground from './AquariumBackground.jsx'
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
      <div className="absolute inset-0 bg-[#0e0b09]/94" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(82,147,141,0.18)_0%,rgba(82,147,141,0.08)_30%,rgba(14,11,9,0)_68%)]" />
      <AquariumBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 text-cream">
        <div className="w-full max-w-4xl">
          <div className="text-center">
            <p className="text-base font-semibold tracking-[0.08em] text-gold drop-shadow-[0_0_18px_rgba(201,164,76,0.18)] sm:text-lg">
              🥜 20 Nutshells spent
            </p>
            <p className="mt-3 text-[1.45rem] font-semibold leading-tight text-cream sm:text-[1.9rem]">
              ✨ A new friend has entered the Reserve.
            </p>
          </div>

          <div className="relative mx-auto mt-10 flex aspect-[4/3] w-full max-w-[22rem] items-center justify-center sm:mt-12 sm:max-w-[26rem] md:max-w-[30rem]">
            <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(201,164,76,0.22)_0%,rgba(95,167,160,0.16)_38%,rgba(95,167,160,0)_72%)] blur-3xl" />
            <div className="absolute inset-x-[30%] bottom-[8%] h-[12%] rounded-[999px] bg-black/45 blur-xl" />
            <span className="absolute bottom-[18%] left-[26%] h-2.5 w-2.5 rounded-full border border-cream/35 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:0s]" />
            <span className="absolute bottom-[14%] left-[42%] h-1.5 w-1.5 rounded-full border border-cream/30 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:0.5s]" />
            <span className="absolute bottom-[20%] right-[28%] h-2 w-2 rounded-full border border-cream/35 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:1.1s]" />
            <span className="absolute bottom-[15%] right-[39%] h-1 w-1 rounded-full border border-cream/30 bg-cream/10 animate-bubble-rise motion-ambient [animation-delay:1.7s]" />

            <div className="relative h-full w-full">
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
