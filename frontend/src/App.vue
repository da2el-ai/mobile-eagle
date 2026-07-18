<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import ToastHost from '@/components/common/ToastHost.vue';
import { useTheme } from '@/composables/use-theme';
import { useI18n } from '@/composables/use-i18n';
import { useSettings } from '@/composables/use-settings';

// テーマを初期化する（起動時に一度だけ）。
useTheme();
const { t } = useI18n();
const { settings, update } = useSettings();

// TODO(base-1): テーマ切替の一時ボタン。設定ダイアログ（settings.md）実装後に撤去する。
const isDark = computed(() => settings.theme === 'dark');
const toggleTheme = (): void => update({ theme: isDark.value ? 'light' : 'dark' });
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg text-fg">
    <header
      class="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-border bg-bg px-2"
    >
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-[9px] text-fg hover:bg-hover"
          :aria-label="t('header.folder')"
        >
          <AppIcon name="menu" :size="24" />
        </button>
      </div>
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-[9px] text-fg hover:bg-hover"
          :aria-label="t('header.filter')"
        >
          <AppIcon name="filter" :size="22" />
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-[9px] text-fg hover:bg-hover"
          :aria-label="t('header.select')"
        >
          <AppIcon name="select" :size="22" />
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-[9px] text-fg hover:bg-hover"
          :aria-label="t('header.settings')"
        >
          <AppIcon name="settings" :size="22" />
        </button>
        <!-- TODO(base-1): テーマ切替の一時ボタン。設定ダイアログ実装後に撤去する。 -->
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-[9px] text-fg hover:bg-hover"
          :aria-label="t('theme.label')"
          @click="toggleTheme"
        >
          <AppIcon :name="isDark ? 'sun' : 'moon'" :size="22" />
        </button>
      </div>
    </header>

    <router-view />

    <ToastHost />
  </div>
</template>
