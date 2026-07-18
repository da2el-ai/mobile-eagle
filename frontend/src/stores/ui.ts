// ダイアログの開閉フラグ（base.md 8 章）。ルーティングしないダイアログをここで管理する。

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const isTreeOpen = ref(false); // フォルダツリー
  const isFilterOpen = ref(false); // フィルタ
  const isSettingsOpen = ref(false); // 設定
  const isMoveOpen = ref(false); // 移動先選択

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
    closeAll,
  };
});
