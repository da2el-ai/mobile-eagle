/**
 * HTTP サーバー本体。起動・停止・ルーティングを担う。
 *
 * ルーティングの流れ:
 *   前段フック（認証。backend/auth.md で差し込む） → /api/* のハンドラ → 静的配信
 */

window.ME = window.ME || {};

ME.server = (() => {
  const http = require('http');

  /** 稼働中のサーバー。停止中は null */
  let server = null;

  /**
   * 前段フック。全リクエストがルーティングの前に通る。
   * true を返すと処理を続行、false を返すとフック側でレスポンス済みとみなして打ち切る。
   * 認証仕様（backend/auth.md）がここを差し替える。
   */
  let beforeRequest = (req, res) => true;

  /**
   * /api/ 配下のルート表。キーは `メソッド パス`。
   * ハンドラは (req, res, url) を受け取る。
   */
  const routes = {
    'GET /api/ping': (req, res) => {
      sendJson(res, 200, { status: 'ok' });
    },
  };

  /**
   * JSON レスポンスを返す。
   * gzip 圧縮（1KB 以上 + Accept-Encoding: gzip）は Step 6 でここに実装する。
   * @param {http.ServerResponse} res
   * @param {number} statusCode
   * @param {object} body
   */
  function sendJson(res, statusCode, body) {
    const json = JSON.stringify(body);
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(json);
  }

  /** リクエスト1件を処理する */
  function handleRequest(req, res) {
    // クエリ・ハッシュを除いたパスに正規化する
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    } catch (err) {
      sendJson(res, 400, { status: 'error', message: 'Bad Request' });
      return;
    }

    ME.logger.log(`${req.method} ${pathname} from ${req.socket.remoteAddress}`);

    // 前段フック（認証の差し込み点）
    if (!beforeRequest(req, res)) return;

    // /api/ 配下はルート表で処理する
    if (pathname.startsWith('/api/')) {
      const handler = routes[`${req.method} ${pathname}`];
      if (handler) {
        // ハンドラ内の例外でサーバーを落とさない
        Promise.resolve()
          .then(() => handler(req, res, pathname))
          .catch((err) => {
            ME.logger.error(`ハンドラでエラー: ${req.method} ${pathname}`, err);
            if (!res.headersSent) {
              sendJson(res, 500, { status: 'error', message: err.message || 'Internal Server Error' });
            }
          });
      } else {
        sendJson(res, 404, { status: 'error', message: 'API endpoint not found' });
      }
      return;
    }

    // /api/ 以外は静的配信（Step 3 で ME.static を実装する）
    if (ME.static) {
      ME.static.serve(pathname, res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }

  return {
    /** サーバーが稼働中かどうか */
    isRunning() {
      return server !== null;
    },

    /**
     * ルートを登録する。各 API モジュールが呼ぶ。
     * @param {string} method 'GET' | 'POST'
     * @param {string} path 例: '/api/eagle/list'
     * @param {(req, res, pathname) => void|Promise} handler
     */
    addRoute(method, path, handler) {
      routes[`${method} ${path}`] = handler;
    },

    /**
     * 前段フックを差し替える（認証仕様が使う）。
     * @param {(req, res) => boolean} hook
     */
    setBeforeRequest(hook) {
      beforeRequest = hook;
    },

    /** sendJson を他モジュールにも公開する */
    sendJson,

    /**
     * サーバーを 0.0.0.0 で起動する。
     * @param {number} port
     * @returns {Promise<void>} 起動失敗時は reject（EADDRINUSE 等）
     */
    start(port) {
      return new Promise((resolve, reject) => {
        if (server) {
          ME.logger.log('サーバーは既に起動しています');
          resolve();
          return;
        }

        const srv = http.createServer(handleRequest);

        srv.once('error', (err) => {
          server = null;
          const hint = err.code === 'EADDRINUSE'
            ? `ポート ${port} は他のアプリが使用中です。ポート番号を変えてください`
            : '';
          ME.logger.error(`サーバーの起動に失敗しました ${hint}`, err);

          // 重大エラー: 機能が使えないため、ウィンドウを出してダイアログでも知らせる
          if (typeof eagle !== 'undefined') {
            eagle.window.show();
            eagle.dialog.showMessageBox({
              type: 'error',
              title: 'Mobile Eagle',
              message: 'サーバーを起動できませんでした',
              detail: hint || (err.message || String(err)),
              buttons: ['OK'],
            });
          }
          reject(err);
        });

        srv.listen(port, '0.0.0.0', () => {
          server = srv;
          ME.logger.log(`サーバーを起動しました 0.0.0.0:${port}`);
          resolve();
        });
      });
    },

    /** サーバーを停止する */
    stop() {
      return new Promise((resolve) => {
        if (!server) {
          resolve();
          return;
        }
        server.close(() => {
          ME.logger.log('サーバーを停止しました');
          resolve();
        });
        server = null;
      });
    },
  };
})();
