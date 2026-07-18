/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  // テーマはクラス（<html class="dark">）で切り替える。色は CSS 変数を参照させ、
  // ライト/ダークの実値は css/main.css 側で切り替える（dark: バリアントは原則使わない）。
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        panel: 'var(--panel)',
        elev: 'var(--elev)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        hover: 'var(--hover)',
        thumb: 'var(--thumb)',
        accent: 'var(--accent)',
        scrim: 'var(--scrim)',
      },
    },
  },
  plugins: [],
};
