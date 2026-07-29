<script setup lang="ts">
import { ref } from 'vue';
import AppDialog from '@/components/common/AppDialog.vue';
import FolderRow from '@/components/folder-tree/FolderRow.vue';
import FolderTreeRow from '@/components/folder-tree/FolderTreeRow.vue';
import { useI18n } from '@/composables/use-i18n';
import { useFoldersStore } from '@/stores/folders';
import { useSelectionStore } from '@/stores/selection';
import { useUiStore } from '@/stores/ui';

// 移動先選択ダイアログ（grid.md 5.5）。行コンポーネントはフォルダツリーと共用する。
const { t } = useI18n();
const folders = useFoldersStore();
const selection = useSelectionStore();
const ui = useUiStore();

// 展開状態は本体のフォルダツリーとは独立させる（grid.md 5.5）。
// 開き直すと畳まれるが、移動先を選ぶ一度きりの操作なので保持しない。
const expandedIds = ref<Set<string>>(new Set());

const toggleExpanded = (id: string): void => {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
};

// キャンセル / × / 背景クリックは閉じるだけで、選択も移動先も変えない。
const close = (): void => {
  ui.isMoveOpen = false;
};

// フォルダを選んだら閉じて確認モードへ。実行はアクションビュー側で行う。
const onSelect = (id: string): void => {
  selection.setMoveTarget(id);
  selection.setActionMode('move');
  close();
};
</script>

<template>
  <AppDialog :title="t('action.moveTitle')" :z-index="70" @close="close">
    <!-- 「すべて」は移動先になり得ないため出さない（モックアップにはあるが意図的に省く）。
         「未分類」を選ぶと所属フォルダを空にする（grid.md 5.5）。 -->
    <FolderRow
      :name="t('breadcrumb.uncategorized')"
      :count="folders.uncategorizedCount"
      @select="onSelect('uncategorized')"
    />
    <FolderTreeRow
      v-for="folder in folders.folders"
      :key="folder.id"
      :folder="folder"
      :expanded-ids="expandedIds"
      @select="onSelect"
      @toggle="toggleExpanded"
    />

    <template #footer>
      <div
        class="sticky bottom-0 flex justify-end border-t border-border bg-panel px-[18px] pb-5 pt-[14px]"
      >
        <button
          type="button"
          class="h-[42px] rounded-[10px] border border-border bg-elev px-4 text-sm text-fg hover:bg-hover"
          @click="close"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </template>
  </AppDialog>
</template>
