module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta oficial do Manual da Marca (Lab. Sobral) — laranja #FB6602 ancorado em 600
        orange: {
          50: '#FFF6F0',
          100: '#FFEDE1',
          200: '#FFDBC2',
          300: '#FEBF95',
          400: '#FE9149',
          500: '#FD7C25',
          600: '#FB6602',
          700: '#CF5402',
          800: '#B14801',
          900: '#933C01',
          950: '#5B2501',
        },
        // Cinza neutro do manual (#6E6E6E / #F4F4F4)
        slate: {
          50: '#F9F9F9',
          100: '#F4F4F4',
          200: '#E4E4E4',
          300: '#D1D1D1',
          400: '#A8A8A8',
          500: '#8A8A8A',
          600: '#6E6E6E',
          700: '#575757',
          800: '#3F3F3F',
          900: '#272727',
          950: '#181818',
        },
      },
      fontFamily: {
        sans: ['Ubuntu', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
