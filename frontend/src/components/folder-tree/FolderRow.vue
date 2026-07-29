<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon.vue';

// ツリーの 1 行（folder-tree.md 5 章）。仮想フォルダ（すべて / 未分類）と実フォルダの
// 両方をこれで描く。移動先選択ダイアログ（grid.md 5.5）からも流用する。
withDefaults(
  defineProps<{
    name: string;
    count: number;
    // インデントの階層（1 階層 16px）。
    depth?: number;
    hasChildren?: boolean;
    isExpanded?: boolean;
    // 現在表示中のフォルダ。移動先選択では常に false。
    isCurrent?: boolean;
  }>(),
  { depth: 0, hasChildren: false, isExpanded: false, isCurrent: false },
);

defineEmits<{ select: []; toggle: [] }>();
</script>

<template>
  <div class="flex items-center" :style="{ paddingLeft: `${depth * 16}px` }">
    <!-- キャレットは子を持つ行だけ。無い行も 26px 分空けて名前の開始位置を揃える。 -->
    <button
      v-if="hasChildren"
      type="button"
      class="flex h-[34px] w-[26px] flex-none items-center justify-center text-muted"
      @click="$emit('toggle')"
    >
      <AppIcon :name="isExpanded ? 'chevron-down' : 'chevron-right'" :size="20" />
    </button>
    <span v-else class="w-[26px] flex-none" />

    <button
      type="button"
      class="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md pl-1 pr-[14px] text-left text-sm text-fg hover:bg-hover"
      :class="isCurrent ? 'bg-hover font-bold' : ''"
      @click="$emit('select')"
    >
      <span class="truncate">{{ name }}</span>
      <span class="flex-none text-xs text-muted">({{ count.toLocaleString() }})</span>
    </button>
  </div>
</template>
