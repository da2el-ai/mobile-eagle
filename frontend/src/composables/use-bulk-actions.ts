import { ref } from 'vue';
import { errorMessage, moveToFolder, moveToTrash, updateItem } from '@/api/eagle-api';
import { useI18n } from '@/composables/use-i18n';
import { useRouteContext } from '@/composables/use-route-context';
import { useToast } from '@/composables/use-toast';
import { useFoldersStore } from '@/stores/folders';
import { useItemsStore } from '@/stores/items';
import { useSelectionStore } from '@/stores/selection';

// 一括操作の実行ロジック（grid.md 5.3〜5.5）。ActionView から使う。
// UI（どのモードでどのボタンを出すか）と実行を分けておく。

export function useBulkActions() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { folderId, filter } = useRouteContext();
  const folders = useFoldersStore();
  const items = useItemsStore();
  const selection = useSelectionStore();

  // 実行中はアクションビューのボタンを無効化する（二重実行防止。grid.md 5.1）。
  const isRunning = ref(false);

  const selectedIds = (): string[] => [...selection.selectedIds];

  // 一括レーティング（grid.md 5.3）。
  // 楽観的更新: 先に画面へ反映し、失敗したアイテムだけ元の値へ戻す。
  async function applyRating(star: number): Promise<void> {
    const ids = selectedIds();
    if (ids.length === 0 || isRunning.value) return;
    isRunning.value = true;

    const previous = new Map<string, number>();
    for (const id of ids) {
      const item = items.items.find((i) => i.id === id);
      if (item) previous.set(id, item.star);
      items.patchItem(id, { star });
    }

    try {
      const results = await Promise.allSettled(ids.map((id) => updateItem(id, { star })));
      const failed = ids.filter((_, index) => results[index].status === 'rejected');
      for (const id of failed) {
        const before = previous.get(id);
        if (before !== undefined) items.patchItem(id, { star: before });
      }
      if (failed.length > 0) showToast(t('action.ratingFailed'));
      // 完了後は default へ戻すが、選択は維持する（続けて別の操作ができる）。
      selection.setActionMode('default');
    } finally {
      isRunning.value = false;
    }
  }

  // 一括削除（grid.md 5.4）。失敗時は何も消さない。
  async function applyDelete(): Promise<void> {
    const ids = selectedIds();
    if (ids.length === 0 || isRunning.value) return;
    isRunning.value = true;
    try {
      await moveToTrash(ids);
      items.removeItems(ids);
      selection.clear();
      // フォルダの件数が減るため、ツリーと子フォルダセル（3.6）の表示を追随させる。
      void folders.load();
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      isRunning.value = false;
    }
  }

  // フォルダ移動（grid.md 5.5）。移動は「置換」なので、移動後は移動先 1 フォルダだけに属する。
  async function applyMove(): Promise<void> {
    const ids = selectedIds();
    const target = selection.moveTargetId;
    if (ids.length === 0 || !target || isRunning.value) return;
    isRunning.value = true;
    try {
      await moveToFolder(ids, target);

      const current = folderId.value;
      if (current !== 'all' && current !== target) {
        // 現在ビューの条件から外れるため一覧から除去する。
        items.removeItems(ids);
      } else {
        // 「すべて」表示中と「現在ビュー = 移動先」は残す。ただし folders を更新しないと
        // Lightbox のフォルダ表示が実態とずれるため、ここで揃えておく。
        const next = target === 'uncategorized' ? [] : [target];
        for (const id of ids) items.patchItem(id, { folders: [...next] });
      }

      selection.clear();
      void folders.load();
    } catch (e) {
      showToast(errorMessage(e));
      // サーバー側で一部だけ移動済みになり得る。表示を実態に合わせるため取り直す。
      await items.loadFirstPage({ folderId: folderId.value, filter: filter.value });
    } finally {
      isRunning.value = false;
    }
  }

  return { isRunning, applyRating, applyDelete, applyMove };
}
