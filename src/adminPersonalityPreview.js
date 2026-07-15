export function openAdminPersonalityCelebrationPreview({ preview, setPreview, setRuntimeAnimation, setQueue }) {
  setRuntimeAnimation(null)
  setQueue([])
  setPreview(preview)
}

export function dismissAdminPersonalityCelebrationPreview(setPreview) {
  setPreview(null)
}
