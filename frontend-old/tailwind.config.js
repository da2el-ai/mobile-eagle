/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{vue,js,ts,jsx,tsx,html}",
  ],
  safelist:[
    'grid-cols-6',
    'grid-cols-5',
    'grid-cols-4',
    'grid-cols-3',
    'grid-cols-2',
    'grid-cols-1',
    'md:grid-cols-8',
    'md:grid-cols-7',
    'md:grid-cols-6',
    'md:grid-cols-5',
    'md:grid-cols-4',
    'md:grid-cols-3',
    'md:grid-cols-2',
    'xl:grid-cols-10',
    'xl:grid-cols-9',
    'xl:grid-cols-8',
    'xl:grid-cols-7',
    'xl:grid-cols-6',
    'xl:grid-cols-5',
    'xl:grid-cols-4',
    'xl:grid-cols-3',
    'xl:grid-cols-2',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
