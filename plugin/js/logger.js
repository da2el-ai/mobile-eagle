/**
 * ログ機構。直近 LOG_LIMIT 件をメモリに保持し、ステータスウィンドウに表示する。
 *
 * 各モジュールは <script> タグで読み込み、グローバルの ME 名前空間で連携する
 * （プラグインのレンダラーでは相対パスの require() の解決基準が保証されないため、
 *  ビルド不要のまま確実に動く方式を採る）。
 */

window.ME = window.ME || {};

ME.logger = (() => {
  // 保持件数の上限（ステータスウィンドウの「直近200件」に合わせる）
  const LOG_LIMIT = 200;

  /** ログ行のバッファ。最新が先頭 */
  const lines = [];

  /** ログ更新時に呼ばれるリスナー（UI の再描画用） */
  const listeners = [];

  /** 現在時刻を HH:MM:SS.mmm 形式にする */
  function timestamp() {
    const now = new Date();
    return (
      now.toLocaleTimeString('ja-JP', { hour12: false }) +
      '.' + String(now.getMilliseconds()).padStart(3, '0')
    );
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener(lines);
      } catch (err) {
        console.error('[MobileEagle] logger listener error:', err);
      }
    }
  }

  return {
    /**
     * ログを1行追加する。
     * @param {string} message
     */
    log(message) {
      lines.unshift(`[${timestamp()}] ${message}`);
      if (lines.length > LOG_LIMIT) {
        lines.length = LOG_LIMIT;
      }
      console.log(`[MobileEagle] ${message}`);
      notify();
    },

    /**
     * エラーをログに追加する。Error オブジェクトも受け取れる。
     * @param {string} message
     * @param {Error} [err]
     */
    error(message, err) {
      const detail = err ? ` (${err.name || 'Error'}: ${err.message || String(err)})` : '';
      this.log(`[ERROR] ${message}${detail}`);
    },

    /** 全ログ行を返す（最新が先頭） */
    getLines() {
      return lines.slice();
    },

    /** ログをすべて消す */
    clear() {
      lines.length = 0;
      notify();
    },

    /**
     * ログ更新時のリスナーを登録する。
     * @param {(lines: string[]) => void} listener
     */
    subscribe(listener) {
      listeners.push(listener);
    },
  };
})();
