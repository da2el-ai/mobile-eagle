// 画像一覧の状態（base.md 8 章）。
// 現在フォルダ・フィルタは store に持たず route から導出する（呼び出し側が ctx で渡す）。
// ただしページング継続に最後のロード条件だけは内部で保持する（route の二重管理にはしない）。

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { errorMessage, fetchItems } from '@/api/eagle-api';
import { ITEM_GET_COUNT } from '@/env';
import { useToast } from '@/composables/use-toast';
import type { TFilter, TImageItem } from '@/types';

// 一覧のロード条件（現在フォルダ + フィルタ）。
export interface LoadContext {
  folderId: string;
  filter: TFilter;
}

export const useItemsStore = defineStore('items', () => {
  const items = ref<TImageItem[]>([]);
  // ロード済みページ数。次ページの offset（ページ番号）として使う。
  const pageCount = ref(0);
  const hasMore = ref(true);
  const isLoading = ref(false);
  const isReloading = ref(false);

  // ページング継続用の最後のロード条件。loadFirstPage で更新する。
  let context: LoadContext | null = null;

  const { showToast } = useToast();

  // リセットして 1 ページ目を読む。items クリア・pageCount=0・hasMore=true を必ずセットで行う
  // （旧バグの根本だったリセット漏れを構造的に防ぐ。base.md 8 章）。
  async function loadFirstPage(ctx: LoadContext): Promise<void> {
    context = ctx;
    items.value = [];
    pageCount.value = 0;
    hasMore.value = true;
    isLoading.value = true;
    try {
      const data = await fetchItems({ folderId: ctx.folderId, filter: ctx.filter, offset: 0 });
      items.value = data;
      pageCount.value = 1;
      // 返却件数 < limit なら終端。以後の追加リクエストを抑止する。
      hasMore.value = data.length >= ITEM_GET_COUNT;
    } catch (e) {
      // 失敗しても hasMore は維持し、再スクロールで再試行できるようにする（base.md 12 章）。
      showToast(errorMessage(e));
    } finally {
      isLoading.value = false;
    }
  }

  // 次のページを追記する。
  async function loadNextPage(): Promise<void> {
    if (!context || !hasMore.value || isLoading.value || isReloading.value) return;
    isLoading.value = true;
    try {
      const data = await fetchItems({
        folderId: context.folderId,
        filter: context.filter,
        offset: pageCount.value,
      });
      items.value.push(...data);
      pageCount.value += 1;
      hasMore.value = data.length >= ITEM_GET_COUNT;
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      isLoading.value = false;
    }
  }

  // 現在ロード済みのページ数ぶんを取り直す（自動リロード用。grid.md 6 章）。
  async function reloadAll(): Promise<void> {
    if (!context || isReloading.value || isLoading.value) return;
    const pages = Math.max(1, pageCount.value);
    isReloading.value = true;
    try {
      const fresh: TImageItem[] = [];
      let more = true;
      let loaded = 0;
      for (let page = 0; page < pages; page += 1) {
        const data = await fetchItems({
          folderId: context.folderId,
          filter: context.filter,
          offset: page,
        });
        fresh.push(...data);
        loaded = page + 1;
        if (data.length < ITEM_GET_COUNT) {
          more = false;
          break;
        }
      }
      items.value = fresh;
      pageCount.value = loaded;
      hasMore.value = more;
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      isReloading.value = false;
    }
  }

  // 楽観的更新: 該当アイテムを部分的に書き換える。
  function patchItem(id: string, patch: Partial<TImageItem>): void {
    const target = items.value.find((item) => item.id === id);
    if (target) Object.assign(target, patch);
  }

  // 一覧から除去する（ゴミ箱移動・フォルダ移動の反映）。
  function removeItems(ids: string[]): void {
    const set = new Set(ids);
    items.value = items.value.filter((item) => !set.has(item.id));
  }

  return {
    items,
    pageCount,
    hasMore,
    isLoading,
    isReloading,
    loadFirstPage,
    loadNextPage,
    reloadAll,
    patchItem,
    removeItems,
  };
});
