<script setup lang="ts">
import { computed } from 'vue';
import StarRating from '@/components/common/StarRating.vue';
import { thumbnailUrl } from '@/api/eagle-api';
import type { ObjectFit } from '@/composables/use-settings';
import type { TImageItem } from '@/types';

// グリッドセル（grid.md 3.3）。
const props = defineProps<{
  item: TImageItem;
  objectFit: ObjectFit;
  // セル 1 個分の実寸（px）。content-visibility の代替サイズに使う。
  cellWidth: number;
  cellHeight: number;
}>();

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
    </div>
    <div class="flex justify-center pb-[5px] pt-[3px]">
      <!-- 未評価は star=0（バックエンドが 0 を返す）。 -->
      <StarRating :model-value="item.star" :size="11" readonly />
    </div>
  </div>
</template>
