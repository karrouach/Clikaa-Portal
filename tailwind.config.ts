import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        clikaa: {
          blue: '#091CCA',
          surface: '#F6F4EF',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 10vw, 8rem)', { lineHeight: '1' }],
        'display-lg': ['clamp(2.5rem, 8vw, 6rem)', { lineHeight: '1.05' }],
        'display-md': ['clamp(2rem, 6vw, 4rem)', { lineHeight: '1.1' }],
      },
      keyframes: {
        // ── General ──────────────────────────────────────────────────────────
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // ── Dialog overlay ───────────────────────────────────────────────────
        'overlay-show': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'overlay-hide': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        // ── Dialog content ───────────────────────────────────────────────────
        'dialog-show': {
          from: { opacity: '0', transform: 'translate(-50%, -46%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'dialog-hide': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, -46%) scale(0.97)' },
        },
        // ── Sheet (right-side panel) ─────────────────────────────────────────
        'sheet-slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'sheet-slide-out': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
        'overlay-show': 'overlay-show 150ms ease',
        'overlay-hide': 'overlay-hide 150ms ease',
        'dialog-show': 'dialog-show 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'dialog-hide': 'dialog-hide 150ms ease forwards',
        'sheet-slide-in': 'sheet-slide-in 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-slide-out': 'sheet-slide-out 250ms ease-in forwards',
      },
    },
  },
  plugins: [],
}

export default config
