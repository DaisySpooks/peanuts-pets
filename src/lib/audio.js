// Centralized sound system. Components call the named helpers below instead
// of creating Audio objects directly, so playback behavior (preloading,
// overlapping one-shots, ambience crossfade-looping, autoplay-block
// handling) lives in exactly one place and stays easy to extend (e.g. a
// future volume/settings panel only needs to change this file).

const SOUND_SOURCES = {
  ambience: '/audio/ambience.mp3',
  affection: '/audio/affection.mp3',
  buttonClick: '/audio/button-click.mp3',
  eating: '/audio/eating.mp3',
  // .m4a, not .mp3 — the .mp3 asset that was here was actually a
  // QuickTime/MOV container mislabeled with an .mp3 extension (`file`
  // identified it as ISO Media, unlike every other sound here which is a
  // real MPEG-ADTS bitstream). Browsers couldn't decode it, which is why
  // it played silently. Re-encoded losslessly-enough to AAC/.m4a, which
  // every evergreen browser's <audio> supports natively.
  foodDrop: '/audio/food-drop.m4a',
  pet: '/audio/pet.mp3',
  play: '/audio/play.mp3',
  tankClean: '/audio/tank-clean.mp3',
}

const hasAudioSupport = typeof Audio !== 'undefined'

const STORAGE_KEY = 'peanuts-pets:audio-enabled'

function loadAudioEnabled() {
  if (typeof localStorage === 'undefined') return true
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    // No stored preference yet — default to enabled.
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

function saveAudioEnabled(enabled) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // Storage unavailable (e.g. private browsing) — preference just won't persist.
  }
}

let audioEnabled = loadAudioEnabled()
// Tracks whether the page has seen a user gesture yet, independent of the
// mute state, so re-enabling audio later knows whether it's safe to call
// play() without hitting the browser's autoplay block.
let hasInteracted = false
let pageIsActive = typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'

export function isAudioEnabled() {
  return audioEnabled
}

export function setAudioEnabled(enabled) {
  audioEnabled = enabled
  saveAudioEnabled(enabled)

  if (!enabled) {
    stopAmbience()
  } else if (hasInteracted && pageIsActive) {
    resumeAmbience()
  }
}

export function toggleAudio() {
  setAudioEnabled(!audioEnabled)
  return audioEnabled
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

// --- One-shot sound effects -------------------------------------------
//
// Each sound keeps a small pool of fully preloaded <audio> elements
// (rotated round-robin) instead of cloneNode()-ing a fresh element per
// play. A freshly cloned node hasn't buffered anything yet, so play()
// on it can incur a real, audible decode/startup delay — pooling ahead
// of time is what actually gets playback close to instant, which matters
// for percussive one-shots (e.g. the food-drop "plop") that read as
// out-of-sync with their visual trigger if they lag even slightly.

const POOL_SIZE = 3
const soundPools = new Map()

function buildPool(name) {
  const elements = Array.from({ length: POOL_SIZE }, () => {
    const audio = new Audio(SOUND_SOURCES[name])
    audio.preload = 'auto'
    return audio
  })
  const pool = { elements, nextIndex: 0 }
  soundPools.set(name, pool)
  return pool
}

function getPooledElement(name) {
  if (!hasAudioSupport) return null
  const pool = soundPools.get(name) ?? buildPool(name)
  const instance = pool.elements[pool.nextIndex]
  pool.nextIndex = (pool.nextIndex + 1) % pool.elements.length
  return instance
}

function preloadAll() {
  if (!hasAudioSupport) return
  Object.keys(SOUND_SOURCES)
    .filter((name) => name !== 'ambience')
    .forEach((name) => buildPool(name))
}

// One-shots get a slight random wobble per play so rapid repeats (e.g.
// mashing Feed) don't sound like the exact same sample fired over and
// over. Ambience is untouched by this — it doesn't go through playSound.
const ONE_SHOT_VOLUME_VARIATION = 0.05
const ONE_SHOT_RATE_VARIATION = 0.02

function jitter(value, range) {
  return value * (1 + (Math.random() * 2 - 1) * range)
}

// Plays `name` as a one-shot sound. Supports optional volume/playbackRate,
// maxDuration (ms) to force-stop playback early, and startOffset (seconds)
// to skip past dead air baked into the start of a source file. Never
// throws — if the browser blocks playback (e.g. no user interaction yet),
// the rejection is swallowed.
function playSound(name, { volume = 1, playbackRate = 1, maxDuration, startOffset = 0 } = {}) {
  if (!audioEnabled) return () => {}

  const instance = getPooledElement(name)
  if (!instance) return () => {}

  instance.currentTime = startOffset
  instance.volume = clamp01(jitter(volume, ONE_SHOT_VOLUME_VARIATION))
  instance.playbackRate = jitter(playbackRate, ONE_SHOT_RATE_VARIATION)

  const stop = () => {
    instance.pause()
    instance.currentTime = 0
  }

  if (maxDuration) {
    setTimeout(stop, maxDuration)
  }

  const playResult = instance.play()
  if (playResult?.catch) {
    playResult.catch(() => {
      // Autoplay blocked or playback failed — fail silently.
    })
  }

  return stop
}

// Kept noticeably quieter than other effects — reserved for ordinary UI
// chrome (a future audio toggle, logout, menu buttons), not the tactile
// feed/play/pet actions, so it shouldn't compete with them for attention.
const BUTTON_CLICK_VOLUME = 0.65

// Clean/play are ambient positive-feedback stingers rather than sharp
// action cues like food-drop/pet — reduced from full volume so they sit
// underneath the rest of the mix instead of popping out. Play was knocked
// down an extra 10% on top of its original 50% cut.
const TANK_CLEAN_VOLUME = 0.5
const PLAY_VOLUME = 0.45

// Eating is a sustained per-bite sound that can repeat several times
// during one Feed action, so it's cut well below full volume (~55%
// reduction) to avoid it dominating the mix.
const EATING_VOLUME = 0.45

// The current food-drop.mp3 already has its "plop" transient right at the
// start (peaks ~40ms in, measured from the waveform) — no offset needed.
// If the file is swapped again, re-measure before reintroducing one; the
// prior asset had ~250ms of dead air and needed startOffset: 0.22.
const FOOD_DROP_START_OFFSET_SECONDS = 0

export function playButtonClick() {
  playSound('buttonClick', { volume: BUTTON_CLICK_VOLUME })
}

export function playFoodDrop(options) {
  return playSound('foodDrop', { startOffset: FOOD_DROP_START_OFFSET_SECONDS, ...options })
}

export function playEating() {
  playSound('eating', { volume: EATING_VOLUME })
}

const PET_VOLUME = 0.2

export function playPet() {
  playSound('pet', { volume: PET_VOLUME })
}

export function playPlay() {
  playSound('play', { volume: PLAY_VOLUME })
}

export function playTankClean() {
  playSound('tankClean', { volume: TANK_CLEAN_VOLUME })
}

// Cut to 20% of full volume so it sits underneath the pet sound it now
// plays alongside, rather than competing with it.
const AFFECTION_VOLUME = 0.2

export function playAffection() {
  playSound('affection', { volume: AFFECTION_VOLUME })
}

// --- Ambience (crossfaded loop) ----------------------------------------
//
// The ambience clip is short (~30s) and doesn't loop cleanly on its own —
// restarting it with the native `loop` attribute produces an audible seam
// at the boundary. Instead, two alternating players crossfade into each
// other a couple of seconds before the clip ends, so the seam is masked
// rather than eliminated (looping a non-seamless recording can't remove
// the seam outright, but a fade hides it).

const AMBIENCE_VOLUME = 0.4
// 2000ms read as a slow, noticeable dip on a ~30s clip — 900ms is still
// long enough to fully mask the loop seam but crosses over quickly enough
// to stay unobtrusive. Kept separate from AMBIENCE_INITIAL_FADE_MS below:
// the loop crossfade should stay snappy, but the very first entrance
// benefits from a slower, gentler ramp so it doesn't announce itself.
const AMBIENCE_FADE_MS = 900
const AMBIENCE_INITIAL_FADE_MS = 3500
const FADE_STEP_MS = 50

let ambienceTracks = null
let ambienceActiveIndex = 0
let ambienceStarted = false
let ambienceSuspended = false
let ambienceResumeOnActive = false
// Guards against triggering more than one crossfade per lap of a track.
let ambienceCrossfadeStarted = false

// Keyed by element (not a flat set) so a new fade on a given track can
// cancel that track's own in-flight fade first — without this, e.g. a
// crossfade starting before the initial fade-in finishes would leave two
// setInterval loops both writing that element's volume, fighting each
// other instead of producing a clean ramp.
const fadeIntervalsByElement = new Map()

function fadeVolume(audioEl, from, to, durationMs) {
  const existingIntervalId = fadeIntervalsByElement.get(audioEl)
  if (existingIntervalId) clearInterval(existingIntervalId)

  audioEl.volume = clamp01(from)
  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
  let step = 0
  const stepSize = (to - from) / steps

  const intervalId = setInterval(() => {
    step += 1
    audioEl.volume = clamp01(from + stepSize * step)
    if (step >= steps) {
      audioEl.volume = clamp01(to)
      clearInterval(intervalId)
      fadeIntervalsByElement.delete(audioEl)
    }
  }, FADE_STEP_MS)

  fadeIntervalsByElement.set(audioEl, intervalId)
}

function cancelAllFades() {
  fadeIntervalsByElement.forEach((intervalId) => clearInterval(intervalId))
  fadeIntervalsByElement.clear()
}

function getAmbienceTracks() {
  if (!hasAudioSupport) return null
  if (!ambienceTracks) {
    const makeTrack = (index) => {
      const audio = new Audio(SOUND_SOURCES.ambience)
      audio.preload = 'auto'
      audio.loop = false
      audio.addEventListener('timeupdate', () => handleAmbienceTimeUpdate(index))
      audio.addEventListener('ended', () => handleAmbienceEnded(index))
      return audio
    }
    ambienceTracks = [makeTrack(0), makeTrack(1)]
  }
  return ambienceTracks
}

function handleAmbienceTimeUpdate(index) {
  if (!ambienceStarted || index !== ambienceActiveIndex || ambienceCrossfadeStarted) return

  const track = ambienceTracks[index]
  if (!Number.isFinite(track.duration) || track.duration <= 0) return

  const remainingMs = (track.duration - track.currentTime) * 1000
  if (remainingMs <= AMBIENCE_FADE_MS) {
    ambienceCrossfadeStarted = true
    crossfadeToNextTrack(Math.max(remainingMs, FADE_STEP_MS))
  }
}

// Fallback for when the crossfade couldn't be scheduled in time (e.g. the
// clip's duration wasn't known yet) — rather than leaving ambience
// silent, just restart the same track from the top.
function handleAmbienceEnded(index) {
  if (!ambienceStarted || index !== ambienceActiveIndex || ambienceCrossfadeStarted) return

  const track = ambienceTracks[index]
  track.currentTime = 0
  track.volume = AMBIENCE_VOLUME
  const playResult = track.play()
  if (playResult?.catch) playResult.catch(() => {})
}

function crossfadeToNextTrack(fadeDurationMs) {
  const fromIndex = ambienceActiveIndex
  const toIndex = fromIndex === 0 ? 1 : 0
  const fromTrack = ambienceTracks[fromIndex]
  const toTrack = ambienceTracks[toIndex]

  toTrack.currentTime = 0
  toTrack.volume = 0
  const playResult = toTrack.play()

  const beginCrossfade = () => {
    if (!audioEnabled) return
    fadeVolume(fromTrack, fromTrack.volume, 0, fadeDurationMs)
    fadeVolume(toTrack, 0, AMBIENCE_VOLUME, fadeDurationMs)
    ambienceActiveIndex = toIndex
    ambienceCrossfadeStarted = false
    setTimeout(() => {
      if (ambienceActiveIndex !== fromIndex) fromTrack.pause()
    }, fadeDurationMs + FADE_STEP_MS)
  }

  if (playResult?.then) {
    playResult.then(beginCrossfade).catch(() => {
      // Couldn't start the next track — leave the current one playing
      // (native loop-less end) and let handleAmbienceEnded restart it.
      ambienceCrossfadeStarted = false
    })
  } else {
    beginCrossfade()
  }
}

export function startAmbience() {
  if (!hasAudioSupport || !audioEnabled || ambienceStarted) return

  const tracks = getAmbienceTracks()
  if (!tracks) return

  ambienceStarted = true
  ambienceCrossfadeStarted = false
  const track = tracks[ambienceActiveIndex]
  track.currentTime = 0
  track.volume = 0

  const playResult = track.play()
  const afterStart = () => {
    // play() is async, so mute can land while this was still pending — if
    // that happened, stop() already ran before playback actually began;
    // catch that here instead of fading up audio that should be silent.
    if (!audioEnabled) {
      stopAmbience()
      return
    }
    fadeVolume(track, 0, AMBIENCE_VOLUME, AMBIENCE_INITIAL_FADE_MS)
  }

  if (playResult?.then) {
    playResult.then(afterStart).catch(() => {
      // Blocked (e.g. called before any user gesture) — allow a later
      // startAmbience() call (such as on next interaction) to retry.
      ambienceStarted = false
    })
  } else {
    afterStart()
  }
}

function pauseAmbience() {
  cancelAllFades()

  const shouldResumeOnActive = ambienceStarted || ambienceResumeOnActive
  ambienceStarted = false
  ambienceCrossfadeStarted = false
  ambienceSuspended = shouldResumeOnActive
  ambienceResumeOnActive = shouldResumeOnActive

  if (!ambienceTracks) return

  const activeTrack = ambienceTracks[ambienceActiveIndex]
  ambienceTracks.forEach((track, index) => {
    track.pause()
    if (index !== ambienceActiveIndex) {
      track.currentTime = 0
      track.volume = 0
    }
  })

  if (activeTrack) {
    activeTrack.volume = Math.min(activeTrack.volume || 0, AMBIENCE_VOLUME)
  }
}

function resumeAmbience() {
  if (!hasAudioSupport || !audioEnabled || !hasInteracted || !pageIsActive || ambienceStarted) return

  if (!ambienceSuspended || !ambienceResumeOnActive) {
    startAmbience()
    return
  }

  const tracks = getAmbienceTracks()
  if (!tracks) return

  const activeTrack = tracks[ambienceActiveIndex]
  const inactiveTrack = tracks[ambienceActiveIndex === 0 ? 1 : 0]
  if (!activeTrack) return

  inactiveTrack.pause()
  inactiveTrack.currentTime = 0
  inactiveTrack.volume = 0

  ambienceStarted = true
  ambienceSuspended = false
  ambienceCrossfadeStarted = false

  const resumeFrom = activeTrack.currentTime > 0 ? 0 : activeTrack.volume
  activeTrack.volume = resumeFrom
  const playResult = activeTrack.play()
  const afterResume = () => {
    if (!audioEnabled || !pageIsActive) {
      pauseAmbience()
      return
    }
    fadeVolume(activeTrack, activeTrack.volume, AMBIENCE_VOLUME, AMBIENCE_FADE_MS)
  }

  if (playResult?.then) {
    playResult.then(afterResume).catch(() => {
      ambienceStarted = false
      ambienceSuspended = true
    })
  } else {
    afterResume()
  }
}

export function stopAmbience() {
  cancelAllFades()
  ambienceStarted = false
  ambienceSuspended = false
  ambienceResumeOnActive = false
  ambienceCrossfadeStarted = false
  ambienceActiveIndex = 0

  if (!ambienceTracks) return
  ambienceTracks.forEach((track) => {
    track.pause()
    track.currentTime = 0
    track.volume = AMBIENCE_VOLUME
  })
}

// Browsers block audio autoplay until the user has interacted with the
// page, so ambience is kicked off from the first click/tap/keypress
// anywhere rather than requiring each screen to wire this up itself.
function attachFirstInteractionListener() {
  if (typeof document === 'undefined') return () => {}

  const events = ['pointerdown', 'keydown']
  const handleFirstInteraction = () => {
    hasInteracted = true
    if (pageIsActive) {
      resumeAmbience()
    }
    if (ambienceStarted || !audioEnabled) {
      events.forEach((event) => document.removeEventListener(event, handleFirstInteraction))
    }
  }

  events.forEach((event) => document.addEventListener(event, handleFirstInteraction))
  return () => {
    events.forEach((event) => document.removeEventListener(event, handleFirstInteraction))
  }
}

let audioLifecycleListenerCount = 0
let detachAudioLifecycleListeners = null

function attachAudioLifecycleListeners() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}

  const detachFirstInteractionListener = attachFirstInteractionListener()
  const handleVisibilityChange = () => {
    pageIsActive = document.visibilityState !== 'hidden'
    if (pageIsActive) {
      resumeAmbience()
      return
    }
    pauseAmbience()
  }
  const handlePageHide = () => {
    pageIsActive = false
    pauseAmbience()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', handlePageHide)

  return () => {
    detachFirstInteractionListener()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pagehide', handlePageHide)
  }
}

export function setupAudioLifecycle() {
  audioLifecycleListenerCount += 1
  if (audioLifecycleListenerCount === 1) {
    detachAudioLifecycleListeners = attachAudioLifecycleListeners()
  }

  return () => {
    audioLifecycleListenerCount = Math.max(0, audioLifecycleListenerCount - 1)
    if (audioLifecycleListenerCount === 0 && detachAudioLifecycleListeners) {
      detachAudioLifecycleListeners()
      detachAudioLifecycleListeners = null
    }
  }
}

preloadAll()
