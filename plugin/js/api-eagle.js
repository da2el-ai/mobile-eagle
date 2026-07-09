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

  /** リクエストボディの上限。これを超えたら受け取らない（メモリ枯渇の防止） */
  const MAX_BODY_BYTES = 1024 * 1024;

  /**
   * POST の JSON ボディを読み取る。
   * @param {http.IncomingMessage} req
   * @returns {Promise<object>}
   */
  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;

      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          // ここで req.destroy() すると 400 を返す前にソケットが切れ、
          // クライアントに理由が伝わらない。読み取りを止めるだけにする
          req.pause();
          reject(ME.server.badRequest('リクエストボディが大きすぎます'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('error', reject);

      req.on('end', () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(ME.server.badRequest('リクエストボディが不正な JSON です'));
        }
      });
    });
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

      // アイテム更新（⭐評価・タグ・注釈・URL）
      ME.server.addRoute('POST', `${PREFIX}/update`, async (req, res) => {
        const body = await readJsonBody(req);
        if (!body.id) throw ME.server.badRequest('id が指定されていません');

        // 送られてきたプロパティだけを更新する（undefined は触らない）
        await ME.eagleAdapter.updateItem(body.id, {
          tags: body.tags,
          annotation: body.annotation,
          url: body.url,
          star: body.star,
        });
        ME.server.sendJson(res, 200, { status: 'success' }, req);
      });

      // ゴミ箱へ移動
      ME.server.addRoute('POST', `${PREFIX}/move_to_trash`, async (req, res) => {
        const body = await readJsonBody(req);
        if (!Array.isArray(body.itemIds) || body.itemIds.length === 0) {
          throw ME.server.badRequest('itemIds が指定されていません');
        }

        await ME.eagleAdapter.moveToTrash(body.itemIds);
        ME.server.sendJson(res, 200, { status: 'success' }, req);
      });

      ME.logger.log(`${PREFIX} のエンドポイントを登録しました`);
    },
  };
})();
