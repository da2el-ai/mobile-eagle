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

  /**
   * バイナリ（画像）を返す。JSON と違い gzip はかけない
   * （JPEG / webp は圧縮済みで効果がなく CPU の無駄になるため）。
   */
  function sendBinary(res, buffer, contentType) {
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': buffer.length });
    res.end(buffer);
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

      // サムネイル配信
      ME.server.addRoute('GET', `${PREFIX}/get_thumbnail_image`, async (req, res) => {
        const query = parseQuery(req.url);
        const item = await ME.eagleAdapter.getItemById(query.id);

        // サムネイルが作られていないアイテムは元ファイルを返す
        const filePath = item.noThumbnail ? item.filePath : item.thumbnailPath;
        const { buffer, contentType } = ME.image.loadRaw(filePath);
        sendBinary(res, buffer, contentType);
      });

      // 画像配信（大きい画像は JPEG 圧縮する）
      ME.server.addRoute('GET', `${PREFIX}/get_image`, async (req, res) => {
        const query = parseQuery(req.url);
        const item = await ME.eagleAdapter.getItemById(query.id);

        // ext は Simple Eagle 互換のため受け取るが使わない
        // （元ファイルのパスを item.filePath から直接得られるため不要になった）
        const maxFileSize = intParam(query, 'max_file_size', 1480);
        // quality=0 は「未指定」の意味なので既定値に倒す（Simple Eagle と同じ）
        const quality = intParam(query, 'quality', 85) || 85;

        const { buffer, contentType } = await ME.image.load(item.filePath, maxFileSize, quality);
        sendBinary(res, buffer, contentType);
      });

      ME.logger.log(`${PREFIX} のエンドポイントを登録しました`);
    },
  };
})();
