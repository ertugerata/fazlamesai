/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./overtime-tracker.tsx",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': {
          DEFAULT: '#005FAA',
          dark: '#004A8B',
        },
      },
    },
  },
  plugins: [],
}
