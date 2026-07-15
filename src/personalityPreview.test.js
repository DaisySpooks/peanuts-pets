import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPersonalityPreviewQueue,
  createPersonalityPreviewActions,
  resolvePersonalityPreviewRuntimeToken,
  resolvePersonalityPreviewUnlock,
} from './personalityPreview.js'

const pet = { petType: 'turtle', petName: 'Test Pet' }

test('resolves every temperament and milestone', () => {
  for (const temperament of ['playful', 'curious', 'gentle', 'sleepy', 'foodie']) {
    for (const level of [1, 3, 5, 8, 12]) {
      assert.equal(resolvePersonalityPreviewUnlock(temperament, level)?.requiredLevel, level)
    }
  }
})

test('builds preview queue in ascending milestone order', () => {
  assert.deepEqual(
    buildPersonalityPreviewQueue({ pet, temperament: 'playful', level: 8 }).map(({ unlock }) => unlock.requiredLevel),
    [1, 3, 5, 8],
  )
})

test('selects the existing runtime token for each level', () => {
  assert.equal(resolvePersonalityPreviewRuntimeToken({ species: 'turtle', temperament: 'playful', level: 1 }), 'happy-bounce')
  assert.equal(resolvePersonalityPreviewRuntimeToken({ species: 'turtle', temperament: 'playful', level: 3 }), 'playtime-welcome')
  assert.equal(resolvePersonalityPreviewRuntimeToken({ species: 'turtle', temperament: 'playful', level: 5 }), 'encore')
  assert.equal(resolvePersonalityPreviewRuntimeToken({ species: 'turtle', temperament: 'playful', level: 8 }), 'show-off')
  assert.equal(resolvePersonalityPreviewRuntimeToken({ species: 'turtle', temperament: 'playful', level: 12 }), 'youre-here')
})

test('unknown selections safely fall back', () => {
  assert.equal(resolvePersonalityPreviewUnlock('unknown', 1), null)
  assert.equal(resolvePersonalityPreviewUnlock('playful', 99), null)
  assert.equal(resolvePersonalityPreviewRuntimeToken({ species: 'unknown', temperament: 'playful', level: 1 }), null)
  assert.deepEqual(buildPersonalityPreviewQueue({ pet, temperament: 'unknown', level: 12 }), [])
})

test('preview actions only invoke supplied callbacks and do not persist', () => {
  const calls = []
  const actions = createPersonalityPreviewActions({
    onCelebration: (payload) => calls.push(['celebration', payload]),
    onRuntime: (payload) => calls.push(['runtime', payload]),
    onQueue: (payload) => calls.push(['queue', payload]),
  })
  actions.previewCelebration('a')
  actions.previewRuntime('b')
  actions.previewQueue('c')
  assert.deepEqual(calls, [['celebration', 'a'], ['runtime', 'b'], ['queue', 'c']])
})
