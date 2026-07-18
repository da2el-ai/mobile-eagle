// 複数選択・アクションビューの状態（base.md 8 章 / grid.md 5 章）。
// 選択状態は item に持たせず、ここで selectedIds（Set）として一元管理する。

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// アクションビューのモード（grid.md 5.1）。
export type ActionMode = 'default' | 'range' | 'rating' | 'move' | 'delete';

export const useSelectionStore = defineStore('selection', () => {
  const isSelectMode = ref(false);
  const selectedIds = ref<Set<string>>(new Set());
  const actionMode = ref<ActionMode>('default');
  // 範囲選択（A→B）の始点「A」。grid.md 5.2
  const rangeAnchorId = ref<string | null>(null);
  // フォルダ移動の移動先（実 ID または 'uncategorized'）。grid.md 5.5
  const moveTargetId = ref<string | null>(null);

  const selectedCount = computed(() => selectedIds.value.size);

  const isSelected = (id: string): boolean => selectedIds.value.has(id);

  function enterSelectMode(): void {
    isSelectMode.value = true;
  }

  // 選択モードを抜ける。選択・モードをすべてクリアする（grid.md 5.1）。
  function exitSelectMode(): void {
    isSelectMode.value = false;
    clear();
  }

  // 単一トグル。Set を作り直して参照を変え、リアクティビティを確実にする。
  function toggle(id: string): void {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }

  // 範囲選択: 表示順の配列で anchor から target までを追加選択する（既存選択は維持。grid.md 5.2）。
  function selectRange(orderedIds: string[], anchorId: string, targetId: string): void {
    const a = orderedIds.indexOf(anchorId);
    const b = orderedIds.indexOf(targetId);
    if (a === -1 || b === -1) return;
    const [from, to] = a <= b ? [a, b] : [b, a];
    const next = new Set(selectedIds.value);
    for (let i = from; i <= to; i += 1) next.add(orderedIds[i]);
    selectedIds.value = next;
  }

  // 選択と関連状態をクリアする（選択モード自体は変えない）。
  function clear(): void {
    selectedIds.value = new Set();
    actionMode.value = 'default';
    rangeAnchorId.value = null;
    moveTargetId.value = null;
  }

  function setActionMode(mode: ActionMode): void {
    actionMode.value = mode;
  }

  function setRangeAnchor(id: string | null): void {
    rangeAnchorId.value = id;
  }

  function setMoveTarget(id: string | null): void {
    moveTargetId.value = id;
  }

  return {
    isSelectMode,
    selectedIds,
    actionMode,
    rangeAnchorId,
    moveTargetId,
    selectedCount,
    isSelected,
    enterSelectMode,
    exitSelectMode,
    toggle,
    selectRange,
    clear,
    setActionMode,
    setRangeAnchor,
    setMoveTarget,
  };
});
