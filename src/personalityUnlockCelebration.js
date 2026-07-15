// Decides whether a petting/Treat action's response should show the
// personality-unlock celebration modal, and clears it again on dismiss.
// Kept as plain functions (rather than inlined in App.jsx) so the decision
// is unit-testable without rendering React.
//
// The server only ever attaches `newlyUnlockedPersonality` to the direct
// response of applyPettingInteraction/applyPetTreat (see server/pets.js) —
// a normal pet lookup (GET /api/pets/me, used on load/reload) never carries
// it. So there's nothing to filter out here for the "don't replay on
// reload" requirement: as long as this is only ever called with the result
// of performPetting()/performTreat(), it naturally never fires from a load.
export function getPersonalityUnlockCelebration(pet) {
  if (!pet?.newlyUnlockedPersonality) return null
  return { pet, unlock: pet.newlyUnlockedPersonality }
}

export function dismissPersonalityUnlockCelebration() {
  return null
}
