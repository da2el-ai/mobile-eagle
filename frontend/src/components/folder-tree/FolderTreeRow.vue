<script setup lang="ts">
import { computed } from 'vue';
import FolderRow from './FolderRow.vue';
import { useFoldersStore } from '@/stores/folders';
import type { TFolderItem } from '@/types';

// 実フォルダの再帰行（folder-tree.md 5 章）。展開状態と選択時の動作は親が決めるため、
// 本体のツリーと移動先選択ダイアログ（grid.md 5.5）で同じものを使える。
const props = withDefaults(
  defineProps<{
    folder: TFolderItem;
    depth?: number;
    expandedIds: Set<string>;
    currentFolderId?: string | null;
  }>(),
  { depth: 0, currentFolderId: null },
);

const emit = defineEmits<{ select: [id: string]; toggle: [id: string] }>();

const folders = useFoldersStore();

const isExpanded = computed(() => props.expandedIds.has(props.folder.id));
// 件数は子孫の合算。元データを書き換えず getter で算出する（folder-tree.md 4 章）。
const count = computed(() => folders.totalImageCount(props.folder));
</script>

<template>
  <FolderRow
    :name="folder.name"
    :count="count"
    :depth="depth"
    :has-children="folder.children.length > 0"
    :is-expanded="isExpanded"
    :is-current="folder.id === currentFolderId"
    @select="emit('select', folder.id)"
    @toggle="emit('toggle', folder.id)"
  />
  <template v-if="isExpanded">
    <FolderTreeRow
      v-for="child in folder.children"
      :key="child.id"
      :folder="child"
      :depth="depth + 1"
      :expanded-ids="expandedIds"
      :current-folder-id="currentFolderId"
      @select="emit('select', $event)"
      @toggle="emit('toggle', $event)"
    />
  </template>
</template>
