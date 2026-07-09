/**
 * 設定の永続化。localStorage の単一キーに JSON でまとめて保存する。
 * serviceMode でも onPluginCreate の時点で同期的に読み出せる（検証済み）。
 */

window.ME = window.ME || {};

ME.settings = (() => {
  const STORAGE_KEY = 'mobile-eagle-settings';

  /** デフォルト値。キーが無い初回起動時はこの内容で作成される */
  const DEFAULTS = {
    serverEnabled: true,
    port: 8000,
    selectedIp: '',
    password: '',
  };

  /** メモリ上の現在値 */
  let current = null;

  /** localStorage から読み込む。壊れていたらデフォルトに戻す */
  function load() {
    let stored = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch (err) {
      ME.logger.error('設定の読み込みに失敗したためデフォルト値を使います', err);
      stored = {};
    }
    // デフォルトとマージすることで、将来設定項目が増えても欠損なく動く
    current = Object.assign({}, DEFAULTS, stored);
    return current;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (err) {
      ME.logger.error('設定の保存に失敗しました', err);
    }
  }

  return {
    /** 全設定を返す（未ロードなら読み込む） */
    getAll() {
      if (!current) load();
      return Object.assign({}, current);
    },

    /**
     * 設定値を1つ返す。
     * @param {string} key
     */
    get(key) {
      return this.getAll()[key];
    },

    /**
     * 設定値を部分更新して保存する。
     * @param {object} partial 例: { serverEnabled: false }
     */
    set(partial) {
      if (!current) load();
      Object.assign(current, partial);
      save();
    },
  };
})();
