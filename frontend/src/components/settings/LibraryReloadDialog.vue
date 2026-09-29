<script setup lang="ts">
import { computed } from 'vue';
import AppDialog from '@/components/common/AppDialog.vue';
import { useI18n } from '@/composables/use-i18n';
import { useLibraryReloadStore } from '@/stores/library-reload';

// ライブラリ再読み込みの実行中ダイアログ（frontend/library-reload.md 7.2）。
// 実行中は閉じられない（Eagle 側の再構築は止められないため）。失敗時だけ閉じるボタンを出す。
const { t } = useI18n();
const reload = useLibraryReloadStore();

// 経過時間を m:ss で表す（15 分でタイムアウトするため時間の桁は要らない）。
const elapsedText = computed(() => {
  const total = Math.max(0, Math.floor(reload.elapsedMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

const errorText = computed(() =>
  reload.failure ? t(`libraryReload.errors.${reload.failure}`) : '',
);
</script>

<template>
  <!-- z-index 90: Lightbox の部品（最大 88）より上、認証 95 より下（base.md 5.2） -->
  <AppDialog :title="t('libraryReload.title')" :z-index="90" :closable="false">
    <div v-if="reload.phase === 'running'" class="flex flex-col items-center gap-4 py-4 text-center">
      <span
        class="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent"
        role="status"
        :aria-label="t('libraryReload.title')"
      />
      <span class="text-3xl font-bold tabular-nums">{{ elapsedText }}</span>
      <p class="text-sm text-muted">
        {{ t('libraryReload.running') }}
      </p>
    </div>

    <div v-else class="flex flex-col gap-4">
      <p class="text-sm leading-relaxed">
        {{ errorText }}
      </p>
      <button
        type="button"
        class="h-11 rounded-[10px] border border-border bg-elev text-base text-fg hover:bg-hover"
        @click="reload.close()"
      >
        {{ t('common.close') }}
      </button>
    </div>
  </AppDialog>
</template>
