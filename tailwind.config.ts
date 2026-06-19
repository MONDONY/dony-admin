import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './app/components/**/*.{vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/features/**/*.vue',
    './app/app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        bg:           'rgb(var(--bg-rgb) / <alpha-value>)',
        surface:      'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-el': 'var(--surface-el)',
        'surface-elevated': 'var(--surface-el)',
        border:       'rgb(var(--border-rgb) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          hover:   'var(--primary-h)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover:   'var(--accent-h)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted:   'var(--muted)',
          subtle:  'var(--subtle)',
        },
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger:  'rgb(var(--danger-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        sans:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:  '16px',
        btn:   '14px',
        sheet: '24px',
        xs:    '8px',   // was 'sm' — renamed to avoid overriding Tailwind's rounded-sm (2px)
        full:  '999px',
      },
      spacing: {
        sidebar: '220px',
        topbar:  '64px',
      },
    },
  },
  plugins: [],
} satisfies Config;
