/**
 * ライブラリの強制再読み込み（backend/library-reload.md）。
 *
 * Eagle のメニュー「キャッシュをクリアしてライブラリを再読み込み」を呼ぶ API は無い
 * （プラグインからは本体の IPC に触れない）。本体の reloadWithoutCache() と同じく
 * ライブラリキャッシュファイルを削除し、未公開 API eagle.library.switch() で開き直して再現する。
 *
 * 手順と理由（詳細は knowledge.md）:
 * 1. キャッシュファイルが無ければ断る（再構築中の switch は読み込みが並行し、ライブラリが一時的に空になる）
 * 2. まず switch だけ呼ぶ（未保存の変更をキャッシュへ書き出させる。これを怠ると削除直後に書き戻される）
 * 3. キャッシュファイルを削除して、もう一度 switch する（キャッシュが無いので再構築になる）
 * 4. onLibraryChanged（読み込み完了の直後に発火する）で完了を判定する
 */

window.ME = window.ME || {};

ME.libraryReload = (() => {
  const fs = require('fs');
  const path = require('path');

  /** 完了を待つ上限（ミリ秒）。NAS 経由の 2.8 万件で約 4 分 20 秒かかった */
  const TIMEOUT_MS = 15 * 60 * 1000;

  /** 1 回目の switch（キャッシュ読み込み）の完了を待つ上限。NAS 経由で約 3.4 秒 */
  const FLUSH_TIMEOUT_MS = 60 * 1000;

  /**
   * 書き戻し判定のしきい値。再構築した場合、キャッシュファイルは発火の約 30ms 前に書き出される。
   * 書き戻された場合は削除直後に書き出され、キャッシュの読み込み（0.3 秒以上）を経てから発火する。
   */
  const WRITE_BACK_THRESHOLD_MS = 1000;

  /** 'idle' | 'running' | 'done' | 'timeout' | 'error' */
  let state = 'idle';
  /** error / timeout の理由コード（backend/library-reload.md 4.3） */
  let reason = null;
  let startedAt = 0;
  let finishedAt = 0;

  /** 実行中の段階。'flush'（1 回目の switch）| 'rebuild'（2 回目の switch 以降）| null */
  let phase = null;
  /** 開始時のライブラリパスとキャッシュファイルのパス */
  let libraryPath = null;
  let cacheFile = null;
  /** 1 回目の switch の完了待ち（onLibraryChanged で resolve する） */
  let flushWaiter = null;

  /**
   * Eagle 本体の hashFnv32a(str, true) と同じ計算（FNV-1a 32bit を 8 桁の hex に）。
   * キャッシュファイル名はライブラリパスのこの値で決まる。
   */
  function hashFnv32a(str) {
    let hval = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hval ^= str.charCodeAt(i);
      hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    return ('0000000' + (hval >>> 0).toString(16)).substr(-8);
  }

  /** ライブラリキャッシュファイルのパス（<userData>/library-caches/<hash>.txt） */
  function cacheFileFor(libPath) {
    return path.join(eagle.app.userDataPath, 'library-caches', `${hashFnv32a(libPath)}.txt`);
  }

  /** ファイルの stat を返す。無ければ null */
  function statOrNull(filePath) {
    try {
      return fs.statSync(filePath);
    } catch (err) {
      return null;
    }
  }

  /** 実行を終える（done / timeout / error） */
  function finish(nextState, nextReason, detail) {
    state = nextState;
    reason = nextReason;
    finishedAt = Date.now();
    phase = null;
    if (flushWaiter) {
      flushWaiter.reject(new Error(nextReason || nextState));
      flushWaiter = null;
    }

    const seconds = Math.round((finishedAt - startedAt) / 1000);
    if (nextState === 'done') {
      ME.logger.log(`ライブラリの再読み込みが完了しました（${seconds}秒）`);
    } else {
      ME.logger.log(`ライブラリの再読み込みを中断しました: ${nextReason}${detail ? `（${detail}）` : ''}`);
    }
  }

  /** 1 回目の switch の完了（onLibraryChanged）を待つ Promise を作る */
  function waitForFlush() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        flushWaiter = null;
        reject(new Error('1 回目の読み込みが時間内に終わりませんでした'));
      }, FLUSH_TIMEOUT_MS);
      flushWaiter = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
    });
  }

  /** switch を呼び、true 以外なら例外にする */
  async function switchLibrary() {
    const result = await eagle.library.switch(libraryPath);
    if (result !== true) throw new Error(`switch の戻り値が true ではありません: ${result}`);
  }

  /** 読み込み完了（onLibraryChanged）で呼ばれる */
  function onLibraryChanged() {
    if (state !== 'running') return;

    // 実行中に別ライブラリへ切り替えられた（同じパスへの switch では変わらない）
    if (eagle.library.path !== libraryPath) {
      finish('error', 'library_changed', eagle.library.path);
      return;
    }

    if (phase === 'flush') {
      if (flushWaiter) {
        flushWaiter.resolve();
        flushWaiter = null;
      }
      return;
    }

    if (phase !== 'rebuild') return;

    // 読み込みが並行した場合、先に終わる方は 0 バイトを書き出す。後の方の発火を待つ
    const stat = statOrNull(cacheFile);
    if (!stat || stat.size === 0) {
      ME.logger.log('ライブラリの再読み込み: キャッシュが空のため次の完了を待ちます');
      return;
    }

    // 書き戻し判定。差は判断材料としてログに残す（しきい値の妥当性はオープン課題）
    const gap = Date.now() - stat.mtimeMs;
    ME.logger.log(`ライブラリの再読み込み: キャッシュ書き出しから完了まで ${Math.round(gap)}ms`);
    if (gap > WRITE_BACK_THRESHOLD_MS) {
      finish('error', 'not_rebuilt', `${Math.round(gap)}ms`);
      return;
    }
    finish('done', null);
  }

  /** 開始処理（start() の応答後に非同期で進める） */
  async function run() {
    libraryPath = eagle.library.path;
    cacheFile = cacheFileFor(libraryPath);

    // キャッシュファイルが無い＝Eagle が再構築中。ここで switch するとライブラリが一時的に空になる
    const stat = statOrNull(cacheFile);
    if (!stat || stat.size === 0) {
      finish('error', 'busy');
      return;
    }

    ME.logger.log(`ライブラリの再読み込みを開始しました: ${libraryPath}`);

    // 1 回目: 未保存の変更をキャッシュへ書き出させる。発火を待つ Promise は switch より先に作る
    phase = 'flush';
    const flushed = waitForFlush();
    try {
      await switchLibrary();
      await flushed;
    } catch (err) {
      flushed.catch(() => {});
      if (state === 'running') finish('error', 'switch_failed', err.message);
      return;
    }
    if (state !== 'running') return;

    // キャッシュを削除する。消えていた（ENOENT）場合はそのまま続行する
    try {
      fs.unlinkSync(cacheFile);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        finish('error', 'delete_failed', err.message);
        return;
      }
    }

    // 2 回目: キャッシュが無いので再構築になる。完了は onLibraryChanged で判定する
    phase = 'rebuild';
    try {
      await switchLibrary();
    } catch (err) {
      if (state === 'running') finish('error', 'switch_failed', err.message);
    }
  }

  // main.js の既存リスナーと共存できる（検証済み）。running 中でない発火は無視する
  eagle.onLibraryChanged(onLibraryChanged);

  return {
    /**
     * 再読み込みを開始する。running 中なら何もしない。
     * 先に running にしてから非同期で進める（await の間に来た 2 本目の要求で二重に始めないため）。
     */
    start() {
      if (state === 'running') return this.getStatus();

      state = 'running';
      reason = null;
      startedAt = Date.now();
      finishedAt = 0;
      run().catch((err) => {
        if (state === 'running') finish('error', 'switch_failed', err.message);
      });
      return this.getStatus();
    },

    /** 状態を返す。タイムアウトはここで判定する */
    getStatus() {
      const now = Date.now();
      if (state === 'running' && now - startedAt > TIMEOUT_MS) {
        finish('timeout', 'timeout');
      }

      let elapsedMs = 0;
      if (state === 'running') elapsedMs = now - startedAt;
      else if (state !== 'idle') elapsedMs = finishedAt - startedAt;

      return { state, elapsedMs, timeoutMs: TIMEOUT_MS, reason };
    },
  };
})();
