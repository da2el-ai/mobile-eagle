// フォルダツリー・拡張子リスト・件数の状態（base.md 8 章）。

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { errorMessage, fetchFolders } from '@/api/eagle-api';
import { useToast } from '@/composables/use-toast';
import type { TFolderItem } from '@/types';

export const useFoldersStore = defineStore('folders', () => {
  const folders = ref<TFolderItem[]>([]);
  // ライブラリ内の拡張子リスト（フィルタ UI の候補。base.md 10 章）。
  const extList = ref<string[]>([]);
  // 未分類（どのフォルダにも属さない）アイテム数。
  const uncategorizedCount = ref(0);
  // 全アイテム数（「すべて」の件数表示。二重計上を避けるため実数）。
  const totalCount = ref(0);
  const isLoaded = ref(false);

  const { showToast } = useToast();

  async function load(): Promise<void> {
    try {
      const res = await fetchFolders();
      folders.value = res.folders;
      extList.value = res.extList;
      uncategorizedCount.value = res.uncategorizedCount;
      totalCount.value = res.totalCount;
      isLoaded.value = true;
    } catch (e) {
      showToast(errorMessage(e));
    }
  }

  // ルートから該当フォルダまでの並び（パンくず用。grid.md 3.2）。
  // 未ロード・不正 ID のときは空配列を返す（パンくずは「すべて」だけになる）。
  function findPath(folderId: string): TFolderItem[] {
    const walk = (list: TFolderItem[], trail: TFolderItem[]): TFolderItem[] | null => {
      for (const folder of list) {
        const next = [...trail, folder];
        if (folder.id === folderId) return next;
        const found = walk(folder.children, next);
        if (found) return found;
      }
      return null;
    };
    return walk(folders.value, []) ?? [];
  }

  // 子孫を含む合算件数（folder-tree.md）。
  // 既知課題: 同じ画像が親子両方のフォルダに属すると二重計上する（base.md 15 章）。
  function totalImageCount(folder: TFolderItem): number {
    let sum = folder.imageCount;
    for (const child of folder.children) sum += totalImageCount(child);
    return sum;
  }

  return {
    folders,
    extList,
    uncategorizedCount,
    totalCount,
    isLoaded,
    load,
    findPath,
    totalImageCount,
  };
});
