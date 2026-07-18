<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import ToastHost from '@/components/common/ToastHost.vue';
import AuthDialog from '@/components/auth/AuthDialog.vue';
import { useTheme } from '@/composables/use-theme';
import { useI18n } from '@/composables/use-i18n';
import { useSettings } from '@/composables/use-settings';
import { useAuthStore } from '@/stores/auth';
import { setUnauthorizedHandler } from '@/api/eagle-api';

// テーマを初期化する（起動時に一度だけ）。
useTheme();
const { t } = useI18n();
const { settings, update } = useSettings();
const auth = useAuthStore();

// 401 共通処理: セッション失効で認証ダイアログを再表示する（auth.md 5 章）。
setUnauthorizedHandler(() => auth.requireLogin());

// 起動時に認証チェック（auth.md 3 章）。status !== 'ok' の間はデータをロードしない。
onMounted(() => auth.check());

// 認証 OK になったらアプリを初期化する。
// TODO(grid): フォルダ取得＋現在 route の loadFirstPage() をここから呼ぶ（grid.md 実装で接続）。
watch(
  () => auth.status,
  (status) => {
    if (status === 'ok') {
      // initApp();
    }
  },
);

// TODO(base-1): テーマ切替の一時ボタン。設定ダイアログ（settings.md）実装後に撤去する。
const isDark = computed(() => settings.theme === 'dark');
const toggleTheme = (): void => update({ theme: isDark.value ? 'light' : 'dark' });
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg text-fg">
    <!-- 認証 OK のときだけシェルを描画する（auth.md 3 章）。 -->
    <template v-if="auth.status === 'ok'">
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
    </template>

    <!-- 接続エラー: 白画面で固まらせず再試行できるようにする（auth.md 3 章）。 -->
    <div
      v-else-if="auth.status === 'error'"
      class="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p class="text-muted">
        {{ t('connection.error') }}
      </p>
      <button
        type="button"
        class="h-11 rounded-[9px] bg-accent px-6 text-base font-bold text-white"
        @click="auth.check()"
      >
        {{ t('connection.retry') }}
      </button>
    </div>

    <!-- checking の間は最小限（一瞬のため空表示）。 -->

    <!-- 認証ダイアログ（required）。 -->
    <AuthDialog v-if="auth.status === 'required'" />

    <ToastHost />
  </div>
</template>
