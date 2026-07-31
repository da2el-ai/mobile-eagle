/**
 * バージョン情報。**manifest.json の version を単一ソースとする。**
 *
 * ソースにハードコーディングせず、起動時に一度だけ manifest.json を読んでキャッシュする。
 * Eagle 自身もプラグイン一覧でこの値を表示するため、二重管理が起きない。
 *
 * eagle.plugin.manifest は plugin-test.md に検証記録がないため使わず、
 * Node.js の fs で読む（プラグイン側は Node.js が使える。coding.md 4 章）。
 */

window.ME = window.ME || {};

ME.version = (() => {
  const fs = require('fs');
  const path = require('path');

  /** 読み取り済みのバージョン。null = 未取得または取得失敗 */
  let cached = null;

  /** 読み取りを試みたか。失敗した場合に毎回読み直さないためのフラグ */
  let tried = false;

  /**
   * manifest.json から version を読む。
   * バージョン表記は補助情報なので、読めなくても致命的にはせず null を返す。
   * @returns {string|null}
   */
  function readFromManifest() {
    try {
      const manifestPath = path.join(ME.static.pluginRoot(), 'manifest.json');
      const version = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version;
      return typeof version === 'string' && version ? version : null;
    } catch (err) {
      ME.logger.error('manifest.json からバージョンを読み取れませんでした', err);
      return null;
    }
  }

  return {
    /**
     * バージョンを読み込む（起動時に一度だけ実際に読む）。
     * ステータスウィンドウの init と onPluginCreate の順序は保証されないため、
     * 両方から呼べるよう冪等にしてある。
     * @returns {string|null}
     */
    load() {
      if (!tried) {
        tried = true;
        cached = readFromManifest();
      }
      return cached;
    },

    /**
     * 読み込み済みのバージョン。未取得・失敗時は null。
     * @returns {string|null}
     */
    get() {
      return cached;
    },

    /**
     * GET /api/version — フロントエンドへバージョンを返す。
     * 認証は不要（auth.js が保護するのは /api/eagle/* のみ）。
     */
    register() {
      ME.server.addRoute('GET', '/api/version', (req, res) => {
        ME.server.sendJson(res, 200, { status: 'success', version: this.load() });
      });
    },
  };
})();
