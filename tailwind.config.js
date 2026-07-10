/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E0D0C',
        gold: '#C9A44C',
        cream: '#F3ECDD',
        aqua: '#2E5E5A',
      },
      keyframes: {
        'bubble-rise': {
          '0%': { bottom: '4%', transform: 'scale(1)', opacity: '0' },
          '8%': { opacity: '0' },
          '20%': { opacity: '0.9' },
          '85%': { opacity: '0.4' },
          '100%': { bottom: '90%', transform: 'scale(1.3)', opacity: '0' },
        },
        'pet-bob': {
          '0%, 100%': { transform: 'translate(-50%, -50%) translateY(0)' },
          '50%': { transform: 'translate(-50%, -50%) translateY(-8px)' },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(-70%)' },
          '100%': { transform: 'translateX(170%)' },
        },
        'glint-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'mote-drift': {
          '0%, 100%': { transform: 'translate(0, 0)', opacity: '0.15' },
          '50%': { transform: 'translate(5px, -12px)', opacity: '0.55' },
        },
        'pellet-drop': {
          // Sinks from its start point toward the mouth with a gentle
          // left-right sway instead of a straight line, like a light
          // pellet drifting down through water.
          '0%': { left: '14%', top: '30%', opacity: '0', transform: 'scale(0.5)' },
          '10%': { opacity: '1', transform: 'scale(1)' },
          '30%': { left: '19%', top: '38%' },
          '50%': { left: '14.5%', top: '45%' },
          '70%': { left: '21%', top: '51%' },
          '90%': { left: '25%', top: '56%', opacity: '1' },
          '100%': { left: '26%', top: '58%', opacity: '0', transform: 'scale(0.4)' },
        },
        'tail-sway': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'gill-drift-left': {
          '0%, 100%': { transform: 'rotate(-2deg) translate(0, 0)' },
          '50%': { transform: 'rotate(2deg) translate(-1px, -1px)' },
        },
        'gill-drift-right': {
          '0%, 100%': { transform: 'rotate(2deg) translate(0, 0)' },
          '50%': { transform: 'rotate(-2deg) translate(1px, -1px)' },
        },
        'limb-float-a': {
          '0%, 100%': { transform: 'rotate(-2deg) translateY(0)' },
          '50%': { transform: 'rotate(2deg) translateY(-1px)' },
        },
        'limb-float-b': {
          '0%, 100%': { transform: 'rotate(2deg) translateY(0)' },
          '50%': { transform: 'rotate(-2deg) translateY(1px)' },
        },
        'clean-sparkle': {
          '0%': { opacity: '0', transform: 'scale(0.3) translateY(0)' },
          '30%': { opacity: '1', transform: 'scale(1) translateY(-1px)' },
          '100%': { opacity: '0', transform: 'scale(0.85) translateY(-4px)' },
        },
        'play-heart': {
          '0%': { opacity: '0', transform: 'scale(0.5) translateY(0)' },
          '30%': { opacity: '1', transform: 'scale(1) translateY(-4px)' },
          '100%': { opacity: '0', transform: 'scale(0.8) translateY(-14px)' },
        },
      },
      animation: {
        'bubble-rise': 'bubble-rise 6s linear infinite backwards',
        'pet-bob': 'pet-bob 4s ease-in-out infinite',
        'shimmer-sweep': 'shimmer-sweep 13s linear infinite',
        'glint-pulse': 'glint-pulse 6s ease-in-out infinite',
        'mote-drift': 'mote-drift 9s ease-in-out infinite',
        'pellet-drop': 'pellet-drop 1800ms ease-in-out forwards',
        'tail-sway': 'tail-sway 3.2s ease-in-out infinite',
        'gill-drift-left': 'gill-drift-left 4s ease-in-out infinite',
        'gill-drift-right': 'gill-drift-right 3.4s ease-in-out infinite',
        'limb-float-back-left': 'limb-float-a 3.6s ease-in-out infinite',
        'limb-float-front-left': 'limb-float-b 4.2s ease-in-out infinite',
        'limb-float-back-right': 'limb-float-b 3.9s ease-in-out infinite',
        'limb-float-front-right': 'limb-float-a 4.5s ease-in-out infinite',
        'clean-sparkle': 'clean-sparkle 900ms ease-out',
        'play-heart': 'play-heart 1100ms ease-out',
      },
    },
  },
  plugins: [],
}
