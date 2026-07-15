import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dismissAdminPersonalityCelebrationPreview,
  openAdminPersonalityCelebrationPreview,
} from './adminPersonalityPreview.js'

test('admin celebration preview opens and dismisses without changing the Admin screen', () => {
  let viewingAdminScreen = true
  let preview = null
  let runtimeAnimation = 'runtime-preview'
  let queue = ['queued-preview']

  const setters = {
    setPreview: (value) => { preview = value },
    setRuntimeAnimation: (value) => { runtimeAnimation = value },
    setQueue: (value) => { queue = value },
  }

  openAdminPersonalityCelebrationPreview({ preview: 'celebration-preview', ...setters })

  assert.equal(viewingAdminScreen, true)
  assert.equal(preview, 'celebration-preview')
  assert.equal(runtimeAnimation, null)
  assert.deepEqual(queue, [])

  dismissAdminPersonalityCelebrationPreview(setters.setPreview)

  assert.equal(viewingAdminScreen, true)
  assert.equal(preview, null)
})
