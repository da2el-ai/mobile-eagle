<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue';
import { useI18n } from '@/composables/use-i18n';
import { useSettings } from '@/composables/use-settings';
import { useSelectionStore } from '@/stores/selection';

// グリッドコントローラー（grid.md 3.5）。画面右下に固定表示する。
const props = defineProps<{
  // 現在のコンテナ幅で許容される最大列数（セル 60px 相当）。
  maxCols: number;
}>();

const { t } = useI18n();
const { settings, update } = useSettings();
const selection = useSelectionStore();

// ＋ = セル拡大 = 列数を減らす。旧実装と +/− の意味が逆（INSTRUCTION.md の要件）。
const onSizeUp = (): void => update({ gridCols: Math.max(1, settings.gridCols - 1) });
const onSizeDown = (): void =>
  update({ gridCols: Math.min(props.maxCols, settings.gridCols + 1) });

const toggleFit = (): void =>
  update({ objectFit: settings.objectFit === 'cover' ? 'contain' : 'cover' });

// 連打でブラウザのダブルタップズームが働く既知問題への対策（base.md 5.2）。
const NO_ZOOM = { touchAction: 'manipulation' } as const;
</script>

<template>
  <div
    class="fixed right-[14px] z-30 flex gap-2"
    :style="{ bottom: selection.isSelectMode ? '86px' : '18px' }"
  >
    <button
      type="button"
      class="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border bg-panel text-fg shadow-[0_2px_8px_rgba(0,0,0,.14)] hover:bg-hover"
      :style="NO_ZOOM"
      :aria-label="t('grid.toggleFit')"
      @click="toggleFit"
    >
      <!-- ダークモードで見えなくなる旧問題を避けるため、アイコンは --fg ベースで描く（grid.md 3.5）。 -->
      <span
        v-if="settings.objectFit === 'cover'"
        class="block h-[18px] w-[18px] rounded-[2px] bg-fg"
      />
      <span v-else class="relative flex h-[18px] w-[18px] items-center justify-center">
        <span class="absolute inset-0 rounded-[2px] bg-fg opacity-50" />
        <span class="relative block h-[14px] w-[6px] rounded-[1px] bg-fg" />
      </span>
    </button>
    <div
      class="flex overflow-hidden rounded-[10px] border border-border bg-panel shadow-[0_2px_8px_rgba(0,0,0,.14)]"
    >
      <button
        type="button"
        class="flex h-[38px] w-[38px] items-center justify-center border-r border-border text-fg hover:bg-hover"
        :style="NO_ZOOM"
        :aria-label="t('grid.sizeDown')"
        @click="onSizeDown"
      >
        <AppIcon name="minus" :size="22" />
      </button>
      <button
        type="button"
        class="flex h-[38px] w-[38px] items-center justify-center text-fg hover:bg-hover"
        :style="NO_ZOOM"
        :aria-label="t('grid.sizeUp')"
        @click="onSizeUp"
      >
        <AppIcon name="plus" :size="22" />
      </button>
    </div>
  </div>
</template>
