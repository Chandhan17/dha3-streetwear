/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0f0f0f',
        canvas: '#050505',
        pearl: '#ffffff',
        accent: '#c48d2f',
        ink: '#f5f5f5',
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        display: ['Anton', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }],
        '7xl': ['4.5rem', { lineHeight: '1.1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(0, 0, 0, 0.28)',
        card: '0 20px 40px -22px rgba(0, 0, 0, 0.44)',
        elevated: '0 20px 60px -16px rgba(0, 0, 0, 0.4)',
      },
      keyframes: {
        rise: {
          '0%': {
            opacity: '0',
            transform: 'translateY(14px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeInScale: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },
      animation: {
        rise: 'rise 0.55s ease-out both',
        'fade-in-scale': 'fadeInScale 0.6s ease-out both',
      },
    },
  },
  plugins: [],
}