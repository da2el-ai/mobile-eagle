import { watch } from 'vue';
import { useSettings, type Theme } from './use-settings';

// テーマ適用（base.md 5.1）。<html> に .dark を付与/除去し、colorScheme も設定する。
// 'auto' は OS の配色設定（prefers-color-scheme）に追従する。

let initialized = false;
let mql: MediaQueryList | null = null;

const effectiveDark = (theme: Theme): boolean => {
  if (theme === 'auto') return mql ? mql.matches : false;
  return theme === 'dark';
};

const apply = (theme: Theme): void => {
  const dark = effectiveDark(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
};

// アプリ起動時に一度だけ呼ぶ（App.vue の setup 内）。
export function useTheme() {
  const { settings } = useSettings();

  if (!initialized) {
    initialized = true;
    mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    apply(settings.theme);

    // OS 配色の変更は 'auto' 選択時のみ反映する。
    mql?.addEventListener('change', () => {
      if (settings.theme === 'auto') apply(settings.theme);
    });

    // 設定のテーマ変更を即座に反映する。
    watch(
      () => settings.theme,
      (theme) => apply(theme),
    );
  }

  return { apply };
}
