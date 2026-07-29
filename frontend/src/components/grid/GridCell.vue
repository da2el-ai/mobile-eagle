<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import StarRating from '@/components/common/StarRating.vue';
import { thumbnailUrl } from '@/api/eagle-api';
import type { ObjectFit } from '@/composables/use-settings';
import type { TImageItem } from '@/types';

// グリッドセル（grid.md 3.3）。
const props = withDefaults(
  defineProps<{
    item: TImageItem;
    objectFit: ObjectFit;
    // セル 1 個分の実寸（px）。content-visibility の代替サイズに使う。
    cellWidth: number;
    cellHeight: number;
    // 選択済みマーカー（青丸 + 白チェック）。範囲選択の始点になっている間は出さない。
    showCheck?: boolean;
    // 範囲選択（A→B）の始点マーカー。チェックの代わりに「A」を出す（grid.md 3.3・5.2）。
    showAnchor?: boolean;
  }>(),
  { showCheck: false, showAnchor: false },
);

defineEmits<{ select: [] }>();

// DOM 仮想化はせず、画面外セルの描画をブラウザに任せる（base.md 11 章）。
// contain-intrinsic-size を実寸に近づけないとスクロールバーが暴れるため、算出値を渡す。
const cellStyle = computed(() => ({
  contentVisibility: 'auto' as const,
  containIntrinsicSize: `${props.cellWidth}px ${props.cellHeight}px`,
}));

const format = computed(() => props.item.ext.toUpperCase());
</script>

<template>
  <div class="relative cursor-pointer select-none" :style="cellStyle" @click="$emit('select')">
    <div class="relative aspect-square w-full overflow-hidden rounded-md bg-thumb">
      <img
        :src="thumbnailUrl(item.id)"
        alt=""
        loading="lazy"
        class="h-full w-full"
        :style="{ objectFit }"
      >
      <div
        class="absolute bottom-1 left-1 rounded-[4px] bg-[rgba(0,0,0,.62)] px-[5px] py-px text-[9px] font-bold tracking-[0.3px] text-white"
      >
        {{ format }}
      </div>

      <!-- 選択マーカー（grid.md 3.3）。オーバーレイの色はモックアップの実値
           （--accent = #2f6fed の 28%）。CSS 変数には alpha 版が無いため直値で持つ。 -->
      <template v-if="showCheck || showAnchor">
        <div class="absolute inset-0 rounded-md border-2 border-accent bg-[rgba(47,111,237,.28)]" />
        <div
          class="absolute right-[5px] top-[5px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-white"
        >
          <AppIcon v-if="showCheck" name="check" :size="16" />
          <span v-else class="text-[12px] font-extrabold leading-none">A</span>
        </div>
      </template>
    </div>
    <div class="flex justify-center pb-[5px] pt-[3px]">
      <!-- 未評価は star=0（バックエンドが 0 を返す）。 -->
      <StarRating :model-value="item.star" :size="11" readonly />
    </div>
  </div>
</template>
