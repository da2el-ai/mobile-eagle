<script setup lang="ts">
import FolderRow from './FolderRow.vue';
import FolderTreeRow from './FolderTreeRow.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useFolderNavigation } from '@/composables/use-folder-navigation';
import { useI18n } from '@/composables/use-i18n';
import { useRouteContext } from '@/composables/use-route-context';
import { useFoldersStore } from '@/stores/folders';
import { useUiStore } from '@/stores/ui';

// フォルダツリーダイアログ（folder-tree.md）。左端からのスライドイン。
// 共通の AppDialog（中央上寄せ）とは枠が異なるため、ここで独自に組む。
const { t } = useI18n();
const folders = useFoldersStore();
const ui = useUiStore();
const { folderId } = useRouteContext();
const { navigateToFolder } = useFolderNavigation();

const close = (): void => {
  ui.isTreeOpen = false;
};

// 行タップはフォルダ移動と同時に閉じる（folder-tree.md 6 章）。
const onSelect = (id: string): void => {
  navigateToFolder(id);
  close();
};
</script>

<template>
  <div
    class="fixed inset-0 z-[60] bg-scrim"
    :style="{ animation: 'fadeIn .15s ease' }"
    @click="close"
  >
    <div
      class="absolute left-0 top-0 h-full w-[320px] max-w-[85vw] overflow-y-auto bg-panel text-fg shadow-[4px_0_24px_rgba(0,0,0,.25)]"
      :style="{ animation: 'sheetIn .22s cubic-bezier(.2,.8,.2,1)' }"
      @click.stop
    >
      <div
        class="sticky top-0 flex items-center justify-between border-b border-border bg-panel px-4 py-[14px]"
      >
        <span class="text-[15px] font-bold">{{ t('header.folder') }}</span>
        <button
          type="button"
          class="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-fg hover:bg-hover"
          :aria-label="t('common.close')"
          @click="close"
        >
          <AppIcon name="close" :size="22" />
        </button>
      </div>

      <div class="p-[18px]">
        <!-- 仮想フォルダ 2 行。件数はバックエンド拡張の実数を使う（folder-tree.md 4 章）。 -->
        <FolderRow
          :name="t('breadcrumb.all')"
          :count="folders.totalCount"
          :is-current="folderId === 'all'"
          @select="onSelect('all')"
        />
        <FolderRow
          :name="t('breadcrumb.uncategorized')"
          :count="folders.uncategorizedCount"
          :is-current="folderId === 'uncategorized'"
          @select="onSelect('uncategorized')"
        />

        <FolderTreeRow
          v-for="folder in folders.folders"
          :key="folder.id"
          :folder="folder"
          :expanded-ids="ui.treeExpandedIds"
          :current-folder-id="folderId"
          @select="onSelect"
          @toggle="ui.toggleTreeExpanded"
        />
      </div>
    </div>
  </div>
</template>
