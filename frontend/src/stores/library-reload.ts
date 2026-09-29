// ライブラリの強制再読み込み（frontend/library-reload.md）。
// 状態の正はサーバーが持つ。ここは実行中ダイアログの表示・ポーリング・経過時間の計算だけを担う。
// ページを開き直しても resume()（認証 OK のたびに呼ぶ）で実行中の表示に戻れる。

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fetchLibraryReloadStatus, startLibraryReload } from '@/api/eagle-api';
import { useI18n } from '@/composables/use-i18n';
import { useToast } from '@/composables/use-toast';
import { useAuthStore } from '@/stores/auth';
import type { TLibraryReload, TLibraryReloadReason } from '@/types';

// ポーリング間隔。Mac では 2〜3 秒で完了するため短めにする。
const POLL_INTERVAL_MS = 5000;
// 経過時間の再描画間隔。
const TICK_MS = 1000;
// 最後にポーリングが成功してから、この時間応答が無ければ諦める
// （サーバーのタイムアウト 15 分＋余裕 1 分。timeoutMs を受け取る前でも使えるよう定数で持つ）。
const UNREACHABLE_MS = 16 * 60 * 1000;

// 失敗の種類。理由コードに加え、フロントエンド側で判定するものを含む。
export type LibraryReloadFailure =
  | TLibraryReloadReason
  | 'idle' // 実行中にプラグインが再起動され、状態が失われた
  | 'start_failed' // 開始要求が届かなかった
  | 'unreachable'; // 状態を確認できないまま時間が経った

export const useLibraryReloadStore = defineStore('libraryReload', () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const auth = useAuthStore();

  // 実行中ダイアログを表示中か。
  const isOpen = ref(false);
  const phase = ref<'running' | 'failed'>('running');
  const failure = ref<LibraryReloadFailure | null>(null);

  // 経過時間は「最後に受け取った elapsedMs ＋ 受け取ってからの時間」で出す。
  // 1 秒ごとの加算だと、バックグラウンドのタブでタイマーが止まる・間引かれてずれるため。
  const baseElapsedMs = ref(0);
  const baseReceivedAt = ref(0);
  const now = ref(Date.now());
  const elapsedMs = computed(() =>
    phase.value === 'running'
      ? baseElapsedMs.value + (now.value - baseReceivedAt.value)
      : baseElapsedMs.value,
  );

  // 完了のたびに 1 増える。自動リロード側が watch して一覧を読み直す（4.5）。
  const completedSeq = ref(0);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let isPolling = false;
  let lastSuccessAt = 0;

  function startTimers(): void {
    // 冪等にする（再ログイン後の resume() で二重に張らない）。
    if (pollTimer === null) pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    if (tickTimer === null) {
      tickTimer = setInterval(() => {
        now.value = Date.now();
      }, TICK_MS);
    }
  }

  function stopTimers(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function fail(kind: LibraryReloadFailure): void {
    stopTimers();
    phase.value = 'failed';
    failure.value = kind;
  }

  function succeed(): void {
    stopTimers();
    isOpen.value = false;
    completedSeq.value += 1;
    showToast(t('libraryReload.done'));
  }

  // サーバーの状態を反映する（POST の応答もポーリングの応答もここを通す。4.2）。
  function apply(reload: TLibraryReload): void {
    lastSuccessAt = Date.now();
    switch (reload.state) {
      case 'running':
        baseElapsedMs.value = reload.elapsedMs;
        baseReceivedAt.value = lastSuccessAt;
        now.value = lastSuccessAt;
        break;
      case 'done':
        succeed();
        break;
      case 'timeout':
      case 'error':
        baseElapsedMs.value = reload.elapsedMs;
        fail(reload.reason ?? 'switch_failed');
        break;
      case 'idle':
        // 実行中のはずが idle に戻っている＝プラグインが再起動された。
        fail('idle');
        break;
    }
  }

  async function poll(): Promise<void> {
    if (isPolling || !isOpen.value || phase.value !== 'running') return;
    if (auth.status !== 'ok') return;
    isPolling = true;
    try {
      apply(await fetchLibraryReloadStatus());
    } catch {
      // 一時的な失敗は判定せず次回へ。401 は共通処理で認証ダイアログに切り替わる。
      if (auth.status === 'ok' && Date.now() - lastSuccessAt > UNREACHABLE_MS) fail('unreachable');
    } finally {
      isPolling = false;
    }
  }

  function open(): void {
    isOpen.value = true;
    phase.value = 'running';
    failure.value = null;
    lastSuccessAt = Date.now();
    baseElapsedMs.value = 0;
    baseReceivedAt.value = lastSuccessAt;
    now.value = lastSuccessAt;
    startTimers();
  }

  // 開始する（確認は呼び出し側の設定ダイアログで済ませる。確認後すぐ設定ダイアログを閉じるため）。
  async function start(): Promise<void> {
    if (isOpen.value) return;

    open();
    try {
      apply(await startLibraryReload());
    } catch {
      // 通信エラーでもサーバー側では開始している可能性がある。状態を 1 回確かめてから判断する。
      try {
        const reload = await fetchLibraryReloadStatus();
        if (reload.state === 'running') apply(reload);
        else fail('start_failed');
      } catch {
        fail('start_failed');
      }
    }
  }

  // 認証 OK になるたびに呼ぶ（起動時・再ログイン後。4.3）。
  async function resume(): Promise<void> {
    // 401 で中断していたポーリングを再開する。
    if (isOpen.value) {
      if (phase.value === 'running') {
        lastSuccessAt = Date.now();
        startTimers();
        void poll();
      }
      return;
    }
    try {
      const reload = await fetchLibraryReloadStatus();
      // 過去の結果（done / timeout / error）は蒸し返さない。実行中のときだけ戻る。
      if (reload.state === 'running' && !isOpen.value) {
        open();
        apply(reload);
      }
    } catch {
      // 復帰チェックは補助。失敗しても何もしない
    }
  }

  // 失敗表示を閉じる。
  function close(): void {
    stopTimers();
    isOpen.value = false;
  }

  // 認証 OK でない間はポーリングを止める（401 を繰り返さない。4.6）。
  watch(
    () => auth.status,
    (status) => {
      if (status !== 'ok') stopTimers();
    },
  );

  return {
    isOpen,
    phase,
    failure,
    elapsedMs,
    completedSeq,
    start,
    resume,
    close,
  };
});
