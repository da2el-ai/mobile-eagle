<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useFoldersStore } from '@/stores/folders';
import type { TFolderItem } from '@/types';

// グリッド先頭に並べる子フォルダセル（grid.md 3.6）。
// パンくずは「戻る」導線のため、ここが「潜る」唯一の低コストな導線になる。
const props = defineProps<{
  folder: TFolderItem;
  // 選択モード中は表示のみ（タップしても遷移しない。grid.md 3.6）。
  disabled: boolean;
}>();

defineEmits<{ select: [] }>();

const folders = useFoldersStore();

// 件数はフォルダツリーと同じ合算件数（直下 + 全子孫）。数字がツリーと食い違わないようにする。
const count = computed(() => folders.totalImageCount(props.folder));

// 画像セルと違い content-visibility は指定しない（先頭に少数並ぶだけのため。grid.md 3.6）。
</script>

<template>
  <div class="select-none" :class="disabled ? '' : 'cursor-pointer'" @click="!disabled && $emit('select')">
    <div
      class="flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-md bg-thumb px-1"
    >
      <AppIcon name="folder" :size="28" class="flex-none text-accent" />
      <span class="mt-1 w-full truncate text-center text-[11px] leading-tight text-fg">
        {{ folder.name }}
      </span>
      <span class="mt-px text-[10px] leading-tight text-muted">
        ({{ count.toLocaleString() }})
      </span>
    </div>
    <!-- 画像セルの星 1 行ぶんの高さを空けて、同じ行に並んだときの高さを揃える。 -->
    <div class="h-[19px]" />
  </div>
</template>
