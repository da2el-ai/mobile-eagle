<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import AppDialog from '@/components/common/AppDialog.vue';
import ChipButton from '@/components/common/ChipButton.vue';
import { useI18n } from '@/composables/use-i18n';
import { useRouteContext } from '@/composables/use-route-context';
import { useFoldersStore } from '@/stores/folders';
import { useUiStore } from '@/stores/ui';

// フィルタダイアログ（grid.md 4 章）。フィルタは route query が唯一の情報源で、
// 絞り込みはすべてサーバー側が行う（base.md 9 章）。
const { t } = useI18n();
const router = useRouter();
const ui = useUiStore();
const folders = useFoldersStore();
const { folderId, filter } = useRouteContext();

// 開いた時点の query をドラフトへ複製する。編集中は一覧に反映しない。
const draft = reactive({
  stars: [...filter.value.stars],
  exts: [...filter.value.exts],
  keyword: filter.value.keyword,
  tags: filter.value.tags.join(', '),
});

const close = (): void => {
  ui.isFilterOpen = false;
};

const toggleStar = (n: number): void => {
  const index = draft.stars.indexOf(n);
  if (index === -1) draft.stars.push(n);
  else draft.stars.splice(index, 1);
};

const toggleExt = (ext: string): void => {
  const index = draft.exts.indexOf(ext);
  if (index === -1) draft.exts.push(ext);
  else draft.exts.splice(index, 1);
};

// 「★n 個 + ☆残り」。0 は ☆☆☆☆☆（未評価）を表す。
const starLabel = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

// フィルタは query 全体を置き換える形で反映する（Lightbox の image は開いていないので残さない）。
const navigate = (query: Record<string, string>): void => {
  void router.push({ name: 'folder', params: { folderId: folderId.value }, query });
  close();
};

const apply = (): void => {
  const query: Record<string, string> = {};
  if (draft.stars.length > 0) query.stars = [...draft.stars].sort((a, b) => a - b).join(',');
  if (draft.exts.length > 0) query.exts = [...draft.exts].sort().join(',');

  const keyword = draft.keyword.trim();
  if (keyword) query.keyword = keyword;

  const tags = draft.tags
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (tags.length > 0) query.tags = tags.join(',');

  navigate(query);
};

// フィルタ解除は query を空にする。
const clear = (): void => navigate({});

const BUTTON_CLASS = 'h-[42px] rounded-[10px] px-4 text-sm';
</script>

<template>
  <AppDialog :title="t('header.filter')" @close="close">
    <div class="flex flex-col gap-[22px]">
      <section class="flex flex-col gap-2.5">
        <span class="text-[13px] font-semibold text-muted">{{ t('filter.stars') }}</span>
        <div class="flex flex-wrap gap-2">
          <ChipButton
            v-for="n in [0, 1, 2, 3, 4, 5]"
            :key="n"
            :active="draft.stars.includes(n)"
            @click="toggleStar(n)"
          >
            {{ starLabel(n) }}
          </ChipButton>
        </div>
      </section>

      <!-- 候補はライブラリ全体の拡張子（バックエンド拡張。base.md 10 章）。
           ロード済み画像から集計していた旧実装と違い、スクロール量で候補が変わらない。 -->
      <section v-if="folders.extList.length > 0" class="flex flex-col gap-2.5">
        <span class="text-[13px] font-semibold text-muted">{{ t('filter.exts') }}</span>
        <div class="flex flex-wrap gap-2">
          <ChipButton
            v-for="ext in folders.extList"
            :key="ext"
            :active="draft.exts.includes(ext)"
            show-check
            @click="toggleExt(ext)"
          >
            {{ ext.toUpperCase() }}
          </ChipButton>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-muted">{{ t('filter.keyword') }}</span>
        <!-- iPhone のフォーカスズームを避けるため文字サイズは 16px 以上（base.md 5.2）。 -->
        <input
          v-model="draft.keyword"
          type="text"
          class="h-11 w-full rounded-[10px] border border-border bg-elev px-[14px] text-base text-fg outline-none focus:border-accent"
          :placeholder="t('filter.keywordPlaceholder')"
        >
      </section>

      <section class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-muted">{{ t('filter.tags') }}</span>
        <input
          v-model="draft.tags"
          type="text"
          class="h-11 w-full rounded-[10px] border border-border bg-elev px-[14px] text-base text-fg outline-none focus:border-accent"
          :placeholder="t('filter.tagsPlaceholder')"
        >
        <span class="text-xs text-muted">{{ t('filter.tagsHelp') }}</span>
      </section>
    </div>

    <template #footer>
      <div
        class="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-panel px-[18px] pb-5 pt-[14px]"
      >
        <button
          type="button"
          :class="[BUTTON_CLASS, 'border border-border bg-elev text-fg hover:bg-hover']"
          @click="close"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          :class="[BUTTON_CLASS, 'border border-border bg-elev text-fg hover:bg-hover']"
          @click="clear"
        >
          {{ t('filter.clear') }}
        </button>
        <button
          type="button"
          :class="[BUTTON_CLASS, 'bg-accent px-5 font-semibold text-white']"
          @click="apply"
        >
          {{ t('common.apply') }}
        </button>
      </div>
    </template>
  </AppDialog>
</template>
