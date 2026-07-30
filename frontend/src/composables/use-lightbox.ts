import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useItemsStore } from '@/stores/items';
import type { TImageItem } from '@/types';

// Lightbox の開閉・前後移動（lightbox.md 4 章）。
// 開閉は route query の `image` が唯一の情報源で、状態を store に持たない（base.md 7 章）。

// 末尾からこの件数まで近づいたら次ページを先読みする（lightbox.md 5 章）。
const PREFETCH_MARGIN = 20;

// withEffects: 先読みと「不在なら閉じる」の watch を登録するか。
// この composable は Lightbox 本体（状態の持ち主）とグリッド（open するだけ）の両方から
// 呼ばれるため、watch を無条件に張ると二重登録になる。本体だけ true にする。
export function useLightbox(options: { withEffects?: boolean } = {}) {
  const route = useRoute();
  const router = useRouter();
  const items = useItemsStore();

  const currentId = computed<string | null>(() => {
    const raw = route.query.image;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value !== '' ? value : null;
  });

  const currentIndex = computed(() =>
    currentId.value === null ? -1 : items.items.findIndex((item) => item.id === currentId.value),
  );

  const current = computed<TImageItem | null>(() =>
    currentIndex.value === -1 ? null : items.items[currentIndex.value],
  );

  const isOpen = computed(() => current.value !== null);

  const prev = computed<TImageItem | null>(() =>
    currentIndex.value > 0 ? items.items[currentIndex.value - 1] : null,
  );

  const next = computed<TImageItem | null>(() =>
    currentIndex.value !== -1 && currentIndex.value < items.items.length - 1
      ? items.items[currentIndex.value + 1]
      : null,
  );

  // 遷移は Promise を返す。削除処理のように「route が変わってから items を触る」順序が
  // 要る場所で await できるようにする（そうしないと下の watch が一瞬の不整合を拾って
  // Lightbox を閉じてしまう）。
  // 開くときだけ履歴を積む。グリッドへはブラウザバック 1 回で戻れる（lightbox.md 4 章）。
  const open = (id: string): Promise<unknown> =>
    router.push({ query: { ...route.query, image: id } });

  const close = (): Promise<unknown> => {
    const query = { ...route.query };
    delete query.image;
    return router.push({ query });
  };

  // 前後移動・リストビューのタップは replace（履歴を積まない）。
  const goTo = (id: string): Promise<unknown> =>
    router.replace({ query: { ...route.query, image: id } });

  const goPrev = (): void => {
    if (prev.value) void goTo(prev.value.id);
  };

  const goNext = (): void => {
    if (next.value) void goTo(next.value.id);
  };

  if (options.withEffects) {
    // 末尾付近まで来たら次ページを読む。リストビューの続きも同時に伸びる。
    watch(currentIndex, (index) => {
      if (index === -1) return;
      if (index >= items.items.length - PREFETCH_MARGIN) void items.loadNextPage();
    });

    // query の image がロード済みに無い場合（URL 直打ち・Eagle 側で削除された等）は
    // 開かずに query を除去する（lightbox.md 7 章）。
    // **初回ページのロード完了を待ってから**判定する。`pageCount === 0` は「まだ 1 度も
    // 読んでいない」状態で、ここで判定すると URL 直打ち（?image=...）が必ず閉じてしまう
    // — 子コンポーネントの setup は親の onMounted（= 初回ロードの開始）より先に走るため、
    // isLoading だけでは「ロード前」と「0 件」を区別できない。
    watch(
      () => [currentId.value, items.isLoading, items.pageCount, items.items.length] as const,
      () => {
        if (currentId.value === null || items.isLoading || items.pageCount === 0) return;
        if (currentIndex.value === -1) void close();
      },
      { immediate: true },
    );
  }

  return { currentId, currentIndex, current, isOpen, prev, next, open, close, goTo, goPrev, goNext };
}
