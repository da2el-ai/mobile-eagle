<script setup lang="ts">
import { onMounted, watch } from 'vue';
import AppHeader from '@/components/header/AppHeader.vue';
import BreadcrumbNav from '@/components/header/BreadcrumbNav.vue';
import ToastHost from '@/components/common/ToastHost.vue';
import AuthDialog from '@/components/auth/AuthDialog.vue';
import { useTheme } from '@/composables/use-theme';
import { useI18n } from '@/composables/use-i18n';
import { useAuthStore } from '@/stores/auth';
import { useFoldersStore } from '@/stores/folders';
import { setUnauthorizedHandler } from '@/api/eagle-api';

// テーマを初期化する（起動時に一度だけ）。
useTheme();
const { t } = useI18n();
const auth = useAuthStore();
const folders = useFoldersStore();

// 401 共通処理: セッション失効で認証ダイアログを再表示する（auth.md 5 章）。
setUnauthorizedHandler(() => auth.requireLogin());

// 起動時に認証チェック（auth.md 3 章）。status !== 'ok' の間はデータをロードしない。
onMounted(() => auth.check());

// 認証 OK になったらフォルダツリー（パンくず・拡張子リストの元）を読む。
// 一覧は GridView のマウント時に読む（再ログイン時も再マウントで復帰する）。
watch(
  () => auth.status,
  (status) => {
    if (status === 'ok') void folders.load();
  },
);
</script>

<template>
  <div class="app-shell flex flex-col overflow-hidden bg-bg text-fg">
    <!-- 認証 OK のときだけシェルを描画する（auth.md 3 章）。 -->
    <template v-if="auth.status === 'ok'">
      <AppHeader />
      <BreadcrumbNav />
      <router-view />
    </template>

    <!-- 接続エラー: 白画面で固まらせず再試行できるようにする（auth.md 3 章）。 -->
    <div
      v-else-if="auth.status === 'error'"
      class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
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
