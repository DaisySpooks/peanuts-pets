// Static background elements: sand, plants, rock/hide.
const layers = [
  'sand.png',
  'plants-left.png',
  'plants-right.png',
  'home-rocks-left.png',
  'rocks-right.png',
]

export default function TankDecor() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {layers.map((file) => (
        <img
          key={file}
          src={`/assets/peanuts-pets-tank/${file}`}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ))}
    </div>
  )
}
