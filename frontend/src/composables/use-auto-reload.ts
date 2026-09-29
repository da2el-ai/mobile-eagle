import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchListMeta } from '@/api/eagle-api';
import { useRouteContext } from '@/composables/use-route-context';
import { useSettings } from '@/composables/use-settings';
import { useAuthStore } from '@/stores/auth';
import { useFoldersStore } from '@/stores/folders';
import { useItemsStore } from '@/stores/items';
import { useLibraryReloadStore } from '@/stores/library-reload';
import { useSelectionStore } from '@/stores/selection';

// 自動リロード（grid.md 6 章）。先頭 1 件のシグネチャを比較して変更を検知する。
// library-info の modificationTime は画像追加で更新されないため使わない（改造版で実証済み）。

// タブ復帰時のデバウンス。モバイルブラウザは visibilitychange が連続発火する。
const RESUME_DEBOUNCE_MS = 300;

export function useAutoReload(getScrollEl: () => HTMLElement | null) {
  const route = useRoute();
  const { folderId, filter } = useRouteContext();
  const { settings } = useSettings();
  const auth = useAuthStore();
  const folders = useFoldersStore();
  const items = useItemsStore();
  const selection = useSelectionStore();
  const libraryReload = useLibraryReloadStore();

  let timer: ReturnType<typeof setInterval> | null = null;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  // 基準シグネチャ。null = 未取得で、次の取得は記録のみ（リロードしない）。
  let baseline: string | null = null;
  // 応答待ちの間に次のタイマーが発火するのを防ぐ。
  let isChecking = false;

  // 一覧を差し替えてよい状態か。選択モード中はリロードで選択が壊れるため止める（grid.md 6.2）。
  const canReload = (): boolean =>
    auth.status === 'ok' &&
    !route.query.image &&
    !selection.isSelectMode &&
    !items.isLoading &&
    !items.isReloading;

  // ポーリングを止める条件（grid.md 6.2）。
  // ライブラリ再読み込み中は古いデータが返るため止める（完了時の読み直しは下の watch で行う）。
  const canPoll = (): boolean =>
    settings.autoReload && !document.hidden && !libraryReload.isOpen && canReload();

  // シグネチャは "${先頭のid}:${先頭のmodificationTime}:${該当総数}"（0 件は 'empty:0'）。
  // **総数を含めるのは削除を検知するため。** 先頭 1 件だけでは、先頭以外のアイテムを
  // 削除しても値が変わらず一覧が更新されない（実機で判明。grid.md 6.1）。
  // 取得失敗時は null を返し、判定せず次回に回す（grid.md 6.2）。
  const readSignature = async (): Promise<string | null> => {
    try {
      const { head, totalCount } = await fetchListMeta({
        folderId: folderId.value,
        filter: filter.value,
      });
      return head ? `${head.id}:${head.modificationTime}:${totalCount}` : `empty:${totalCount}`;
    } catch {
      return null;
    }
  };

  const check = async (): Promise<void> => {
    if (isChecking || !canPoll()) return;
    isChecking = true;
    try {
      const signature = await readSignature();
      if (signature === null) return;
      // 初回は基準を記録するだけ。
      if (baseline === null) {
        baseline = signature;
        return;
      }
      if (signature === baseline) return;
      baseline = signature;

      // 応答を待つ間に選択モードへ入る等の変化があり得るため、実行直前に再確認する。
      if (!canPoll()) return;

      await reloadKeepingScroll();
    } finally {
      isChecking = false;
      // チェック中に届いた完了の読み直しを取りこぼさない。
      void runForcedReload();
    }
  };

  // 一覧とフォルダを読み直す。
  // スクロール位置は差し替えで失われるため、記録して復元する（grid.md 6.3）。
  const reloadKeepingScroll = async (): Promise<void> => {
    const el = getScrollEl();
    const top = el?.scrollTop ?? 0;
    await items.reloadAll();
    await nextTick();
    if (el) el.scrollTop = top;

    // 子フォルダセル（3.6）とツリーの件数も追随させる。
    void folders.load();
  };

  // ライブラリ再読み込みの完了時に、1 回だけ強制的に読み直す（library-reload.md 4.5）。
  // 自動更新の設定が OFF でも行う（ユーザーが明示的に実行した操作の結果のため）。
  // 選択モード中・Lightbox 表示中・ロード中は保留し、条件が外れた時点で実行する。
  let isForcedPending = false;
  const runForcedReload = async (): Promise<void> => {
    if (!isForcedPending || isChecking || !canReload()) return;
    isForcedPending = false;
    // 基準を捨てる。残すと次のポーリングで「変化あり」と判定され、2 回目の読み直しが走る。
    baseline = null;
    isChecking = true;
    try {
      await reloadKeepingScroll();
    } finally {
      isChecking = false;
    }
  };

  watch(
    () => libraryReload.completedSeq,
    () => {
      isForcedPending = true;
      void runForcedReload();
    },
  );

  // 保留中の読み直しを、実行できる状態になったら行う。
  watch(
    () => [auth.status, route.query.image, selection.isSelectMode, items.isLoading, items.isReloading],
    () => void runForcedReload(),
  );

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  // 設定が変わったらタイマーを張り直す（間隔の変更を即座に反映する）。
  const start = (): void => {
    stop();
    if (!settings.autoReload) return;
    timer = setInterval(() => void check(), settings.autoReloadInterval * 1000);
  };

  const onVisibilityChange = (): void => {
    if (resumeTimer !== null) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    if (document.hidden) return;
    // 復帰時はデバウンス後に即座に 1 回チェックし、その後ポーリングを再開する。
    resumeTimer = setTimeout(() => {
      void check();
      start();
    }, RESUME_DEBOUNCE_MS);
  };

  watch(() => [settings.autoReload, settings.autoReloadInterval], start);

  // 表示コンテキストが変わるとシグネチャの意味も変わるため、基準を捨てて初回扱いに戻す。
  watch(
    () => JSON.stringify([folderId.value, filter.value]),
    () => {
      baseline = null;
    },
  );

  // 再ログイン後の再初期化でも基準をリセットする（auth.md 5 章 / grid.md 6.2）。
  watch(
    () => auth.status,
    (status) => {
      if (status === 'ok') baseline = null;
    },
  );

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    start();
  });

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stop();
    if (resumeTimer !== null) clearTimeout(resumeTimer);
  });
}
