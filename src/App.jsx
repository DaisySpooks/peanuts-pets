import HabitatScreen from './components/HabitatScreen.jsx'
import { pet, stats, actions } from './mockData.js'

export default function App() {
  return <HabitatScreen pet={pet} stats={stats} actions={actions} />
}
