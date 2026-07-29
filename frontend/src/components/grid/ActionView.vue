<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useBulkActions } from '@/composables/use-bulk-actions';
import { useI18n } from '@/composables/use-i18n';
import { useFoldersStore } from '@/stores/folders';
import { useSelectionStore } from '@/stores/selection';
import { useUiStore } from '@/stores/ui';

// アクションビュー（grid.md 5.1）。選択モード中だけ画面下端に固定表示する。
const { t, tf } = useI18n();
const folders = useFoldersStore();
const selection = useSelectionStore();
const ui = useUiStore();
const { isRunning, applyRating, applyDelete, applyMove } = useBulkActions();

// rating モードで編集中の値。モードに入るたび 0 から始める。
const ratingDraft = ref(0);
watch(
  () => selection.actionMode,
  (mode) => {
    if (mode === 'rating') ratingDraft.value = 0;
  },
);

// 0 件選択では実行させない（grid.md 7 章）。実行中も無効化する（二重実行防止）。
const canApply = computed(() => selection.selectedCount > 0 && !isRunning.value);

const moveTargetName = computed(() => {
  const target = selection.moveTargetId;
  if (!target) return '';
  if (target === 'uncategorized') return t('breadcrumb.uncategorized');
  const path = folders.findPath(target);
  return path[path.length - 1]?.name ?? '';
});

const onRangeBtn = (): void => {
  selection.setRangeAnchor(null);
  selection.setActionMode('range');
};

const onMoveBtn = (): void => {
  ui.isMoveOpen = true;
};

// キャンセルは範囲選択の「A」と移動先を破棄して default へ戻す（grid.md 5.2・5.5）。
const onCancel = (): void => {
  selection.setRangeAnchor(null);
  selection.setMoveTarget(null);
  selection.setActionMode('default');
};

const PILL = 'flex h-10 items-center justify-center rounded-[20px] text-sm';
const OUTLINE = 'border border-border bg-elev text-fg hover:bg-hover';
const ICON_BUTTON = `${PILL} w-11 ${OUTLINE}`;
// 削除は破壊的操作なので赤（モックアップの実値）。
const DANGER = '#e2554b';
</script>

<template>
  <div
    class="fixed bottom-0 left-0 z-40 flex h-[72px] w-screen items-center justify-between gap-2 border-t border-border bg-panel px-[14px] shadow-[0_-3px_14px_rgba(0,0,0,.12)]"
    :class="isRunning ? 'pointer-events-none opacity-50' : ''"
  >
    <!-- default: 件数と各操作の入り口 -->
    <template v-if="selection.actionMode === 'default'">
      <div class="text-sm font-semibold">
        {{ tf('action.selectedCount', { n: selection.selectedCount }) }}
      </div>
      <div class="flex items-center gap-2">
        <button type="button" :class="[PILL, OUTLINE, 'px-[14px] font-semibold']" @click="onRangeBtn">
          {{ t('action.range') }}
        </button>
        <button
          type="button"
          :class="ICON_BUTTON"
          :style="{ color: '#f5b301' }"
          :aria-label="t('action.rating')"
          @click="selection.setActionMode('rating')"
        >
          <span class="text-base leading-none">★</span>
        </button>
        <button
          type="button"
          :class="ICON_BUTTON"
          :aria-label="t('action.move')"
          @click="onMoveBtn"
        >
          <AppIcon name="move" :size="22" />
        </button>
        <button
          type="button"
          :class="ICON_BUTTON"
          :style="{ color: DANGER }"
          :aria-label="t('action.delete')"
          @click="selection.setActionMode('delete')"
        >
          <AppIcon name="delete" :size="22" />
        </button>
      </div>
    </template>

    <!-- range: 始点・終点の指定待ち（選択はグリッド側で行う） -->
    <template v-else-if="selection.actionMode === 'range'">
      <div class="text-sm font-semibold">
        {{ t('action.rangeHint') }}
      </div>
      <button type="button" :class="[PILL, OUTLINE, 'px-[18px]']" @click="onCancel">
        {{ t('common.cancel') }}
      </button>
    </template>

    <!-- rating: 星を選んでから実行 -->
    <template v-else-if="selection.actionMode === 'rating'">
      <div class="flex gap-0.5 text-[26px] leading-none">
        <span
          v-for="n in 5"
          :key="n"
          class="cursor-pointer"
          :style="{
            color: n <= ratingDraft ? '#f5b301' : 'var(--fg)',
            opacity: n <= ratingDraft ? 1 : 0.28,
          }"
          @click="ratingDraft = ratingDraft === n ? 0 : n"
        >★</span>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          :class="[PILL, 'bg-accent px-4 font-semibold text-white', canApply ? '' : 'opacity-50']"
          :disabled="!canApply"
          @click="applyRating(ratingDraft)"
        >
          {{ t('action.apply') }}
        </button>
        <button type="button" :class="[PILL, OUTLINE, 'px-4']" @click="onCancel">
          {{ t('common.cancel') }}
        </button>
      </div>
    </template>

    <!-- move: 移動先を選んだあとの確認 -->
    <template v-else-if="selection.actionMode === 'move'">
      <div class="min-w-0 truncate text-sm font-semibold">
        {{ tf('action.confirmMove', { n: selection.selectedCount, name: moveTargetName }) }}
      </div>
      <div class="flex flex-none gap-2">
        <button
          type="button"
          :class="[PILL, 'bg-accent px-4 font-semibold text-white', canApply ? '' : 'opacity-50']"
          :disabled="!canApply"
          @click="applyMove"
        >
          {{ t('action.apply') }}
        </button>
        <button type="button" :class="[PILL, OUTLINE, 'px-4']" @click="onCancel">
          {{ t('common.cancel') }}
        </button>
      </div>
    </template>

    <!-- delete: 削除の確認 -->
    <template v-else-if="selection.actionMode === 'delete'">
      <div class="text-sm font-semibold">
        {{ tf('action.confirmDelete', { n: selection.selectedCount }) }}
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          :class="[PILL, 'px-4 font-semibold text-white', canApply ? '' : 'opacity-50']"
          :style="{ background: DANGER }"
          :disabled="!canApply"
          @click="applyDelete"
        >
          {{ t('action.apply') }}
        </button>
        <button type="button" :class="[PILL, OUTLINE, 'px-4']" @click="onCancel">
          {{ t('common.cancel') }}
        </button>
      </div>
    </template>
  </div>
</template>
