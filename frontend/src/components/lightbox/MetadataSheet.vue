<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useI18n } from '@/composables/use-i18n';
import { useFoldersStore } from '@/stores/folders';
import { formatDateTime, formatSizeKB } from '@/utils/format';
import type { TImageItem } from '@/types';

// メタデータビュー（lightbox.md 6 章）。画像タップでオーバーレイ表示する下部シート。
// 色はテーマによらず固定（Lightbox 全体が暗い背景のため）。
const props = defineProps<{
  item: TImageItem;
  isDeleting: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  rate: [star: number];
  selectFolder: [folderId: string];
  selectTag: [tag: string];
}>();

const { t } = useI18n();
const folders = useFoldersStore();

// フォルダ名は解決できなければ ID をそのまま出す（削除済みフォルダ等）。
const folderName = (id: string): string => {
  const path = folders.findPath(id);
  return path[path.length - 1]?.name ?? id;
};

const resolution = computed(() => `${props.item.width} x ${props.item.height} px`);

const LABEL = 'w-16 flex-none text-[rgba(255,255,255,.55)]';
const BADGE =
  'rounded-[20px] bg-[rgba(255,255,255,.14)] px-2.5 py-[3px] text-xs text-white hover:bg-[rgba(255,255,255,.24)]';
</script>

<template>
  <!--
    サムネイルリストビュー（88px）の上に重ねる。
    高さは max-height: 50vh。メタデータが多いと画面を覆い尽くすため上限を下げた（lightbox.md 6 章）。

    **backdrop-filter は使わない。** Safari で、このシートに backdrop-filter を掛けると
    **シートが覆っている領域だけ**背後の画像が再描画されず、1 回分古い画像が残る
    （A/B テストで確定。lightbox.md 6 章の既知の罠）。
    ぼかしの代わりに背景の不透明度を上げて可読性を確保する。
  -->
  <div
    class="fixed bottom-[88px] left-0 z-[86] max-h-[50vh] w-screen overflow-y-auto bg-[rgba(0,0,0,.82)] px-[18px] pb-[26px] pt-5 text-white"
    :style="{ animation: 'metaIn .28s cubic-bezier(.2,.8,.2,1)' }"
    @click.stop
  >
    <!-- 削除ボタンは右上（旧実装の下部から移動。lightbox.md 6 章）。 -->
    <button
      type="button"
      class="absolute right-[14px] top-[14px] flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[rgba(255,255,255,.12)] text-white hover:bg-[rgba(255,255,255,.22)]"
      :class="isDeleting ? 'pointer-events-none opacity-50' : ''"
      :aria-label="t('lightbox.delete')"
      @click="emit('delete')"
    >
      <AppIcon name="delete" :size="22" />
    </button>

    <!-- 評価は 30px。旧実装の「小さくて押しにくい」への対策（lightbox.md 6 章）。 -->
    <div class="mb-4 flex gap-1 text-[30px] leading-none">
      <span
        v-for="n in 5"
        :key="n"
        class="cursor-pointer"
        :style="{ color: n <= item.star ? '#f5b301' : 'rgba(255,255,255,.32)' }"
        @click="emit('rate', item.star === n ? 0 : n)"
      >★</span>
    </div>

    <div class="mb-2.5 break-all pr-11 text-[17px] font-bold">
      {{ item.name }}
    </div>

    <div
      v-if="item.annotation"
      class="mb-3.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[rgba(255,255,255,.82)]"
    >
      {{ item.annotation }}
    </div>

    <div class="flex flex-col gap-[11px] text-[13px]">
      <div v-if="item.folders.length > 0" class="flex gap-3">
        <span :class="LABEL">{{ t('lightbox.folder') }}</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="folderId in item.folders"
            :key="folderId"
            type="button"
            :class="BADGE"
            @click="emit('selectFolder', folderId)"
          >
            {{ folderName(folderId) }}
          </button>
        </div>
      </div>

      <!-- タグ: 移植元にあったがモックアップから落ちていた要素（lightbox.md 6.3）。
           タップでそのタグの絞り込みへ。 -->
      <div v-if="item.tags.length > 0" class="flex gap-3">
        <span :class="LABEL">{{ t('lightbox.tags') }}</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag in item.tags"
            :key="tag"
            type="button"
            :class="BADGE"
            @click="emit('selectTag', tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <div class="flex gap-3">
        <span :class="LABEL">{{ t('lightbox.size') }}</span>
        <span>{{ formatSizeKB(item.size) }}</span>
      </div>
      <div class="flex gap-3">
        <span :class="LABEL">{{ t('lightbox.format') }}</span>
        <span>{{ item.ext.toUpperCase() }}</span>
      </div>
      <div class="flex gap-3">
        <span :class="LABEL">{{ t('lightbox.resolution') }}</span>
        <span>{{ resolution }}</span>
      </div>
      <!-- 「最終変更」は出さない。プラグイン API に modifiedAt しか無く更新日時と同値になる
           （lightbox.md 6 章のユーザー決定）。 -->
      <div class="flex gap-3">
        <span :class="LABEL">{{ t('lightbox.modified') }}</span>
        <span>{{ formatDateTime(item.modificationTime) }}</span>
      </div>
    </div>
  </div>
</template>
