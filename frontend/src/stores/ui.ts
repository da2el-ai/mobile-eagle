// ダイアログの開閉フラグ（base.md 8 章）。ルーティングしないダイアログをここで管理する。

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const isTreeOpen = ref(false); // フォルダツリー
  const isFilterOpen = ref(false); // フィルタ
  const isSettingsOpen = ref(false); // 設定
  const isMoveOpen = ref(false); // 移動先選択

  // フォルダツリーの展開状態（folder-tree.md 5 章）。永続化はせず、セッション中だけ保持する。
  // ダイアログはアンマウントされるためコンポーネントローカルには置けない
  // （閉じて開き直しても展開状態が残る必要がある）。
  const treeExpandedIds = ref<Set<string>>(new Set());

  // Set の参照を差し替えてリアクティビティを確実にする。
  function toggleTreeExpanded(id: string): void {
    const next = new Set(treeExpandedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    treeExpandedIds.value = next;
  }

  // すべて閉じる（Lightbox を開くときなどに使う）。
  function closeAll(): void {
    isTreeOpen.value = false;
    isFilterOpen.value = false;
    isSettingsOpen.value = false;
    isMoveOpen.value = false;
  }

  return {
    isTreeOpen,
    isFilterOpen,
    isSettingsOpen,
    isMoveOpen,
    treeExpandedIds,
    toggleTreeExpanded,
    closeAll,
  };
});
