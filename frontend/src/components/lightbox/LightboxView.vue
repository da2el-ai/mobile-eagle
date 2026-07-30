<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FilmstripView from './FilmstripView.vue';
import MetadataSheet from './MetadataSheet.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { errorMessage, imageUrl, moveToTrash, updateItem } from '@/api/eagle-api';
import { useFolderNavigation } from '@/composables/use-folder-navigation';
import { useI18n } from '@/composables/use-i18n';
import { useLightbox } from '@/composables/use-lightbox';
import { useToast } from '@/composables/use-toast';
import { useFoldersStore } from '@/stores/folders';
import { useItemsStore } from '@/stores/items';
import type { LocationQuery } from 'vue-router';
import type { TImageItem } from '@/types';

// Lightbox 本体（lightbox.md 3・4 章）。開閉は route query `image` に従う。
const { t, tf } = useI18n();
const route = useRoute();
const router = useRouter();
const { showToast } = useToast();
const { navigateToFolder } = useFolderNavigation();
const folders = useFoldersStore();
const items = useItemsStore();
// 状態の持ち主なので watch も登録する（グリッド側は open だけ使う）。
const { current, currentIndex, prev, next, close, goTo, goPrev, goNext } = useLightbox({
  withEffects: true,
});

const showMeta = ref(false);
const isDeleting = ref(false);
// get_image が失敗した画像の id（代替表示に切り替える。lightbox.md 7 章）。
const failedId = ref<string | null>(null);

// 前後移動ボタンの押下表示（lightbox.md 3 章）。
// CSS の :active は **iOS Safari で発火しない**（タッチイベントのリスナーが無い要素では
// active 状態にならない）。PC だけ白くなってスマホで反応しないため、pointer イベントで
// 明示的に状態を持つ。:active には戻さないこと。
const pressed = ref<'prev' | 'next' | null>(null);
const NAV_BASE =
  'fixed top-0 z-[82] h-[calc(100vh-88px)] w-[min(200px,20vw)] transition-colors';
// 排他にする。bg-transparent と bg-[#ffffff42] を同時に付けると、
// どちらが勝つかは生成 CSS の順序次第になり不安定。
const navClass = (side: 'prev' | 'next'): string =>
  pressed.value === side ? 'bg-[#ffffff42]' : 'bg-transparent';

// 画像タップでメタデータビューをトグルする（lightbox.md 4 章）。
const toggleMeta = (): void => {
  showMeta.value = !showMeta.value;
};

// 削除後の遷移先を決める。次が無ければ前、どちらも無ければ閉じる（lightbox.md 6.1）。
const afterDeleteTarget = (): TImageItem | null => next.value ?? prev.value;

const onDelete = async (): Promise<void> => {
  const item = current.value;
  if (!item || isDeleting.value) return;
  if (!window.confirm(tf('lightbox.confirmDelete', { name: item.name }))) return;

  isDeleting.value = true;
  const target = afterDeleteTarget();
  try {
    await moveToTrash([item.id]);
    // **先に遷移を完了させてから** items を触る。逆順だと「削除済み id を指した query」の
    // 状態が一瞬でき、use-lightbox の watch がそれを拾って Lightbox を閉じてしまう。
    if (target) await goTo(target.id);
    else await close();
    items.removeItems([item.id]);
    // 件数（ツリー・子フォルダセル）を追随させる。
    void folders.load();
  } catch (e) {
    // 失敗時は何も消さない（lightbox.md 6.1）。
    showToast(errorMessage(e));
  } finally {
    isDeleting.value = false;
  }
};

// レーティング変更（lightbox.md 6.2）。楽観的更新 → 失敗時はロールバック。
// items store を書き換えるのでグリッドのセル表示にも反映される。
const onRate = async (star: number): Promise<void> => {
  const item = current.value;
  if (!item) return;
  const before = item.star;
  items.patchItem(item.id, { star });
  try {
    await updateItem(item.id, { star });
  } catch {
    items.patchItem(item.id, { star: before });
    showToast(t('lightbox.ratingFailed'));
  }
};

// フォルダバッジ: そのフォルダへ移動して Lightbox を閉じる。
const onSelectFolder = (folderId: string): void => {
  navigateToFolder(folderId);
};

// タグバッジ: そのタグ 1 つで絞り込む（lightbox.md 6.3）。
// 現在フォルダと他のフィルタは維持し、image だけ落として Lightbox を閉じる。
const onSelectTag = (tag: string): void => {
  const query: LocationQuery = { ...route.query, tags: tag };
  delete query.image;
  void router.push({ query });
};

// 画像が切り替わったら読み込み失敗フラグを解除する（別の画像は読めるかもしれない）。
// 押下表示も落とす（移動でボタンが消えると pointerup を受け取れず、押されたままになる）。
watch(current, () => {
  failedId.value = null;
  pressed.value = null;
});
</script>

<template>
  <!-- 背景はテーマによらず固定。半透明にしない（lightbox.md 3 章）。 -->
  <div
    v-if="current"
    class="fixed inset-0 z-[80] grid bg-[#232729]"
    style="grid-template-rows: 1fr 88px"
    :style="{ animation: 'fadeIn .15s ease' }"
  >
    <div class="relative flex min-h-0 cursor-pointer items-center justify-center" @click="toggleMeta">
      <img
        v-if="failedId !== current.id"
        :src="imageUrl(current.id)"
        alt=""
        class="max-h-full max-w-full object-contain"
        @error="failedId = current.id"
      >
      <!-- 読み込み失敗時の代替表示。前後移動・削除は可能なまま（lightbox.md 7 章）。 -->
      <div v-else class="flex flex-col items-center gap-2 px-8 text-center text-white">
        <p class="text-sm opacity-80">
          {{ t('lightbox.loadFailed') }}
        </p>
        <p class="break-all text-xs opacity-60">
          {{ current.name }}
        </p>
      </div>
    </div>

    <FilmstripView
      :items="items.items"
      :current-index="currentIndex"
      @select="goTo"
      @near-end="items.loadNextPage()"
    />

    <!--
      前後移動ボタン。リストビュー（88px）には被せない。
      押下表示は pointer イベントで持つ（:active は iOS Safari で効かない。上のコメント参照）。
      **インラインで background を直書きしないこと** — 詳細度でクラス指定が負ける
      （lightbox.md 3 章の既知の罠）。
    -->
    <button
      v-if="prev"
      type="button"
      :class="[NAV_BASE, navClass('prev'), 'left-0']"
      :aria-label="t('lightbox.prev')"
      @pointerdown="pressed = 'prev'"
      @pointerup="pressed = null"
      @pointercancel="pressed = null"
      @pointerleave="pressed = null"
      @click.stop="goPrev"
    />
    <button
      v-if="next"
      type="button"
      :class="[NAV_BASE, navClass('next'), 'right-0']"
      :aria-label="t('lightbox.next')"
      @pointerdown="pressed = 'next'"
      @pointerup="pressed = null"
      @pointercancel="pressed = null"
      @pointerleave="pressed = null"
      @click.stop="goNext"
    />

    <button
      type="button"
      class="fixed right-3 top-3 z-[84] flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[rgba(0,0,0,.4)] text-white hover:bg-[rgba(0,0,0,.6)]"
      :aria-label="t('common.close')"
      @click.stop="close"
    >
      <AppIcon name="close" :size="24" />
    </button>

    <MetadataSheet
      v-if="showMeta"
      :item="current"
      :is-deleting="isDeleting"
      @delete="onDelete"
      @rate="onRate"
      @select-folder="onSelectFolder"
      @select-tag="onSelectTag"
    />
  </div>
</template>
