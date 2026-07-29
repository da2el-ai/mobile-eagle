<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useI18n } from '@/composables/use-i18n';
import { useRouteContext } from '@/composables/use-route-context';
import { useSettings } from '@/composables/use-settings';
import { useSelectionStore } from '@/stores/selection';
import { useUiStore } from '@/stores/ui';

// グリッドビューのヘッダー（grid.md 3.1）。アプリ名は表示しない。
const { t } = useI18n();
const { isFilterActive } = useRouteContext();
const ui = useUiStore();
const selection = useSelectionStore();

// 40×40・角丸 9px は モックアップの実寸（base.md 5.2 でタップ領域より優先）。
const BUTTON_CLASS = 'flex h-10 w-10 items-center justify-center rounded-[9px]';
const stateClass = (active: boolean): string =>
  active ? 'bg-accent text-white' : 'text-fg hover:bg-hover';

// 選択モードを抜けるときは選択内容も破棄する（grid.md 5.1）。
const toggleSelectMode = (): void => {
  if (selection.isSelectMode) selection.exitSelectMode();
  else selection.enterSelectMode();
};

// TODO(base-1): テーマ切替の一時ボタン。設定ダイアログ（settings.md）実装後に撤去する。
const { settings, update } = useSettings();
const isDark = computed(() => settings.theme === 'dark');
const toggleTheme = (): void => update({ theme: isDark.value ? 'light' : 'dark' });
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-bg px-2"
  >
    <div class="flex items-center gap-0.5">
      <button
        type="button"
        :class="[BUTTON_CLASS, stateClass(false)]"
        :aria-label="t('header.folder')"
        @click="ui.isTreeOpen = true"
      >
        <AppIcon name="menu" :size="24" />
      </button>
    </div>
    <div class="flex items-center gap-0.5">
      <button
        type="button"
        :class="[BUTTON_CLASS, stateClass(isFilterActive)]"
        :aria-label="t('header.filter')"
        @click="ui.isFilterOpen = true"
      >
        <AppIcon name="filter" :size="22" />
      </button>
      <button
        type="button"
        :class="[BUTTON_CLASS, stateClass(selection.isSelectMode)]"
        :aria-label="t('header.select')"
        @click="toggleSelectMode"
      >
        <AppIcon name="select" :size="22" />
      </button>
      <button
        type="button"
        :class="[BUTTON_CLASS, stateClass(false)]"
        :aria-label="t('header.settings')"
        @click="ui.isSettingsOpen = true"
      >
        <AppIcon name="settings" :size="22" />
      </button>
      <!-- TODO(base-1): テーマ切替の一時ボタン。設定ダイアログ実装後に撤去する。 -->
      <button
        type="button"
        :class="[BUTTON_CLASS, stateClass(false)]"
        :aria-label="t('theme.label')"
        @click="toggleTheme"
      >
        <AppIcon :name="isDark ? 'sun' : 'moon'" :size="22" />
      </button>
    </div>
  </header>
</template>
