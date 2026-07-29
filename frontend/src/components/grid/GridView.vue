<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ActionView from './ActionView.vue';
import FolderCell from './FolderCell.vue';
import GridCell from './GridCell.vue';
import GridController from './GridController.vue';
import { useAutoReload } from '@/composables/use-auto-reload';
import { useFolderNavigation } from '@/composables/use-folder-navigation';
import { useI18n } from '@/composables/use-i18n';
import { useRouteContext } from '@/composables/use-route-context';
import { useSettings } from '@/composables/use-settings';
import { useFoldersStore } from '@/stores/folders';
import { useItemsStore } from '@/stores/items';
import { useSelectionStore } from '@/stores/selection';
import type { TFolderItem, TImageItem } from '@/types';

// グリッドビュー本体（grid.md 3.3・3.4）。DOM 仮想化はせず content-visibility に任せる（base.md 11 章）。

// モックアップの gap / padding。
const GRID_GAP = 3;
// 最大列数の基準となるセル幅（INSTRUCTION.md。デザイン指示書の 64px ではなくこちらを採用）。
const MIN_CELL_WIDTH = 60;
// セル下の星 1 行ぶんの高さ（11px + 上下 padding）。contain-intrinsic-size の見積もりに使う。
const STAR_ROW_HEIGHT = 19;

const { t } = useI18n();
const route = useRoute();
const { folderId, filter } = useRouteContext();
const { settings, update } = useSettings();
const { navigateToFolder } = useFolderNavigation();
const folders = useFoldersStore();
const items = useItemsStore();
const selection = useSelectionStore();

const scrollRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

// 自動リロード（grid.md 6 章）。スクロール位置の復元にコンテナを渡す。
useAutoReload(() => scrollRef.value);

// 列数はブレークポイント別ではなく単一の数値。表示時はコンテナ幅で clamp する（grid.md 3.5）。
const maxCols = computed(() => Math.max(1, Math.floor(containerWidth.value / MIN_CELL_WIDTH)));
const cols = computed(() => Math.min(settings.gridCols, maxCols.value));

const cellWidth = computed(() => {
  const inner = containerWidth.value - GRID_GAP * 2 - GRID_GAP * (cols.value - 1);
  return Math.max(1, Math.floor(inner / cols.value));
});
const cellHeight = computed(() => cellWidth.value + STAR_ROW_HEIGHT);

// 回転・リサイズで最大列数を超えたら設定値そのものを詰める（grid.md 7 章）。
watch(maxCols, (max) => {
  if (containerWidth.value > 0 && settings.gridCols > max) update({ gridCols: max });
});

const isEmpty = computed(() => !items.isLoading && items.items.length === 0);

// グリッド先頭に並べる子フォルダ（grid.md 3.6）。
// 仮想フォルダ（すべて / 未分類）では表示しない。フィルタ適用中は常に表示する
// （フィルタが絞るのは画像のみで、潜る導線は残す）。
const childFolders = computed<TFolderItem[]>(() => {
  if (folderId.value === 'all' || folderId.value === 'uncategorized') return [];
  const path = folders.findPath(folderId.value);
  return path[path.length - 1]?.children ?? [];
});

let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;

// IntersectionObserver は交差状態が変わらないと再通知しない。1 ページ読んでも画面が
// 埋まらない場合に続きが読めなくなるため、監視を張り直して再評価させる。
const reobserveSentinel = (): void => {
  if (!intersectionObserver || !sentinelRef.value) return;
  intersectionObserver.unobserve(sentinelRef.value);
  intersectionObserver.observe(sentinelRef.value);
};

const loadCurrent = async (): Promise<void> => {
  await items.loadFirstPage({ folderId: folderId.value, filter: filter.value });
  await nextTick();
  reobserveSentinel();
};

const onIntersect = async (entries: IntersectionObserverEntry[]): Promise<void> => {
  if (!entries[0]?.isIntersecting) return;
  // 自動リロード中の誤発火も抑止する（grid.md 3.4）。
  if (items.isLoading || items.isReloading || !items.hasMore) return;
  await items.loadNextPage();
  await nextTick();
  reobserveSentinel();
};

// フォルダ・フィルタが変わったら 1 ページ目から取り直す。
// Lightbox の image query は対象にしない（開閉のたびに一覧がリセットされる事故を防ぐ。base.md 7 章）。
watch(
  () => JSON.stringify([folderId.value, filter.value]),
  async () => {
    // 選択対象が画面から消えるため、選択モードは解除する（grid.md 7 章）。
    if (selection.isSelectMode) selection.exitSelectMode();
    scrollRef.value?.scrollTo({ top: 0 });
    await loadCurrent();
  },
);

onMounted(async () => {
  const container = scrollRef.value;
  if (container) {
    containerWidth.value = container.clientWidth;
    resizeObserver = new ResizeObserver((entries) => {
      containerWidth.value = entries[0].contentRect.width;
    });
    resizeObserver.observe(container);
  }
  if (container && sentinelRef.value) {
    // root は window ではなく内部スクロールの <main>（base.md 11 章）。
    intersectionObserver = new IntersectionObserver(onIntersect, {
      root: container,
      rootMargin: '100px',
    });
    intersectionObserver.observe(sentinelRef.value);
  }
  // 認証 OK になって初めてこのビューが描画されるため、マウント時が初回ロードのタイミング。
  // 401 後の再ログインでも再マウントされ、ここから再初期化される（auth.md 5 章）。
  await loadCurrent();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});

// 範囲選択（A→B）の基準になる表示順。フォルダセルは対象外（grid.md 3.6）。
const orderedIds = computed(() => items.items.map((item) => item.id));

// 範囲選択（grid.md 5.2）。A 未設定なら始点、設定済みなら終点として確定する。
const onRangeTap = (item: TImageItem): void => {
  const anchor = selection.rangeAnchorId;
  if (!anchor) {
    selection.setRangeAnchor(item.id);
    return;
  }
  // 始点と同じセルの再タップは「A」の解除として扱う（grid.md 7 章）。
  if (anchor === item.id) {
    selection.setRangeAnchor(null);
    return;
  }
  selection.selectRange(orderedIds.value, anchor, item.id);
  selection.setRangeAnchor(null);
  selection.setActionMode('default');
};

const onSelectCell = (item: TImageItem): void => {
  if (selection.actionMode === 'range') {
    onRangeTap(item);
    return;
  }
  if (selection.isSelectMode) {
    selection.toggle(item.id);
    return;
  }
  // TODO(lightbox): 通常時は query に image={id} を push して Lightbox を開く（grid.md 3.3）。
};

// 子フォルダへ潜る。フィルタ query は維持される（use-folder-navigation）。
const onSelectFolder = (folder: TFolderItem): void => {
  navigateToFolder(folder.id);
};
</script>

<template>
  <main ref="scrollRef" class="flex-1 overflow-y-auto" style="-webkit-overflow-scrolling: touch">
    <!--
      1fr は minmax(auto, 1fr) と等価で、セルの min-content 幅より細くならない。
      セルは content-visibility の contain-intrinsic-size で幅を主張するため、
      列数を増やしてもトラックが縮まずグリッドが画面外へはみ出す。下限を 0 にして防ぐ。
    -->
    <div
      class="grid gap-[3px] p-[3px]"
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
    >
      <!-- 子フォルダは画像より前（grid.md 3.6）。ページングとは無関係に常に全件並べる。 -->
      <FolderCell
        v-for="folder in childFolders"
        :key="`folder-${folder.id}`"
        :folder="folder"
        :disabled="selection.isSelectMode"
        @select="onSelectFolder(folder)"
      />

      <GridCell
        v-for="item in items.items"
        :key="item.id"
        :item="item"
        :object-fit="settings.objectFit"
        :cell-width="cellWidth"
        :cell-height="cellHeight"
        :show-check="
          selection.isSelectMode &&
            selection.isSelected(item.id) &&
            selection.rangeAnchorId !== item.id
        "
        :show-anchor="selection.actionMode === 'range' && selection.rangeAnchorId === item.id"
        @select="onSelectCell(item)"
      />
    </div>

    <!-- 無限スクロールの番兵。グリッド直後に置き、最下部の余白より手前で発火させる。 -->
    <div ref="sentinelRef" class="h-px w-full" />

    <div v-if="isEmpty" class="px-5 py-[60px] text-center text-sm text-muted">
      {{ t('grid.empty') }}
    </div>

    <!-- グリッドコントローラーがサムネイルに被らないための余白（grid.md 3.3）。 -->
    <div class="h-[120px]" />
  </main>

  <!-- Lightbox 表示中は隠す（grid.md 3.5）。 -->
  <GridController v-if="!route.query.image" :max-cols="maxCols" />

  <ActionView v-if="selection.isSelectMode" />
</template>
