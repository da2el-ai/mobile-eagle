/**
 * /api/eagle 配下のエンドポイント。
 * パス・パラメータ・レスポンス形式は Simple Eagle と互換に保つ
 * （フロントエンドを無改変で流用するため）。
 */

window.ME = window.ME || {};

ME.apiEagle = (() => {
  const PREFIX = '/api/eagle';

  /**
   * クエリ文字列をパースする。
   * @param {string} url リクエストの生 URL
   */
  function parseQuery(url) {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return {};
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }

  /**
   * 整数のクエリパラメータを取り出す。不正値なら既定値を使う。
   */
  function intParam(query, key, defaultValue) {
    const num = Number(query[key]);
    return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : defaultValue;
  }

  return {
    register() {
      // 画像一覧
      ME.server.addRoute('GET', `${PREFIX}/list`, async (req, res) => {
        const query = parseQuery(req.url);
        const items = await ME.eagleAdapter.getItems({
          limit: intParam(query, 'limit', 200),
          // offset はページ番号（アイテム数ではない）。Simple Eagle と同じ仕様
          offset: intParam(query, 'offset', 0),
          keyword: query.keyword,
          ext: query.ext,
          tags: query.tags,
          folders: query.folders,
        });
        ME.server.sendJson(res, 200, { status: 'success', data: items }, req);
      });

      // フォルダ一覧
      ME.server.addRoute('GET', `${PREFIX}/folders`, async (req, res) => {
        const folders = await ME.eagleAdapter.getFolders();
        ME.server.sendJson(res, 200, { status: 'success', data: folders }, req);
      });

      ME.logger.log(`${PREFIX}/list と ${PREFIX}/folders を登録しました`);
    },
  };
})();
