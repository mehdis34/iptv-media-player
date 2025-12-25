/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b0f',
        ember: '#e50914',
        ash: '#1b1b24',
        mist: '#a7a7b3',
        slate: '#2a2a36',
      },
      fontFamily: {
        display: ['BebasNeue_400Regular', 'System'],
        body: ['Archivo_400Regular', 'System'],
        bodySemi: ['Archivo_600SemiBold', 'System'],
      },
    },
  },
  plugins: [],
};
