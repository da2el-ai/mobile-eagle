<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useFolderNavigation } from '@/composables/use-folder-navigation';
import { useI18n } from '@/composables/use-i18n';
import { useRouteContext } from '@/composables/use-route-context';
import { useFoldersStore } from '@/stores/folders';

// パンくずリスト（grid.md 3.2）。先頭は常に「すべて」。
const { t } = useI18n();
const folders = useFoldersStore();
const { folderId } = useRouteContext();
const { navigateToFolder } = useFolderNavigation();

interface Crumb {
  id: string;
  name: string;
}

const crumbs = computed<Crumb[]>(() => {
  const list: Crumb[] = [{ id: 'all', name: t('breadcrumb.all') }];
  if (folderId.value === 'all') return list;
  if (folderId.value === 'uncategorized') {
    list.push({ id: 'uncategorized', name: t('breadcrumb.uncategorized') });
    return list;
  }
  for (const folder of folders.findPath(folderId.value)) {
    list.push({ id: folder.id, name: folder.name });
  }
  return list;
});
</script>

<template>
  <nav
    class="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-bg px-3 py-[9px] text-[13px]"
  >
    <template v-for="(crumb, index) in crumbs" :key="crumb.id">
      <AppIcon
        v-if="index > 0"
        name="chevron-right"
        :size="16"
        class="text-muted opacity-60"
      />
      <button
        type="button"
        class="max-w-[140px] truncate rounded-md px-1.5 py-[3px] hover:bg-hover"
        :class="index === crumbs.length - 1 ? 'font-bold text-fg' : 'text-accent'"
        @click="navigateToFolder(crumb.id)"
      >
        {{ crumb.name }}
      </button>
    </template>
  </nav>
</template>
