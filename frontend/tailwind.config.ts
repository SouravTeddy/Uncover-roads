import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f172a',
        surface: '#1e293b',
        'surf-hst': '#334155',
        primary: '#3b82f6',
        'primary-c': '#2563eb',
        orange: '#f97316',
        'orange-c': '#ea6c00',
        'text-1': '#f1f5f9',
        'text-2': '#cbd5e1',
        'text-3': '#8e9099',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
