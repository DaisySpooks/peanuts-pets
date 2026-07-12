export const pet = {
  name: 'Mochi',
  species: 'Axolotl',
}

export const defaultStats = [
  { key: 'hunger', label: 'Hunger', value: 78 },
  { key: 'cleanliness', label: 'Cleanliness', value: 86 },
  { key: 'happiness', label: 'Happiness', value: 92 },
  { key: 'affection', label: 'Affection', value: 0 },
]

export const actions = [
  { key: 'feed', label: 'Feed', status: 'available' },
  { key: 'clean', label: 'Clean', status: 'cooldown', readyIn: '4h 22m' },
  { key: 'play', label: 'Play', status: 'cooldown', readyIn: '2h 15m' },
]
