/**
 * 静的ファイル配信。public/ 配下をHTTPで配信する。
 *
 * 移植元（Simple Eagle index.py）の配信ルールを踏襲する:
 *   - /assets/ 配下は実ファイルが無ければ 404（ビルド成果物のアセット）
 *   - それ以外のパスは実ファイルが無ければ index.html を返す（Vue Router の履歴モード対応）
 */

window.ME = window.ME || {};

ME.static = (() => {
  const fs = require('fs');
  const path = require('path');

  /** 拡張子 → Content-Type */
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
  };

  /**
   * プラグインのルートディレクトリを解決する。
   * .eagleplugin としてインストールされた後の展開先でも有効（T8 で検証済み）。
   */
  function resolvePluginRoot() {
    // 1. eagle.plugin.path があれば最優先
    if (typeof eagle !== 'undefined' && eagle.plugin && eagle.plugin.path) {
      return eagle.plugin.path;
    }
    // 2. index.html の場所から導出する
    try {
      if (location.href.startsWith('file://')) {
        return path.dirname(decodeURIComponent(new URL(location.href).pathname));
      }
    } catch (err) {
      // 導出できなければ次の手段へ
    }
    // 3. 最後の手段。js/ の親ディレクトリ
    return path.resolve(__dirname, '..');
  }

  /** 配信ディレクトリ（public/）の絶対パス */
  function publicDir() {
    return path.join(resolvePluginRoot(), 'public');
  }

  /**
   * ファイルを1つ配信する。
   * @param {string} filePath 絶対パス
   * @param {http.ServerResponse} res
   * @param {() => void} onMissing ファイルが無い場合の処理
   */
  function sendFile(filePath, res, onMissing) {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        onMissing();
        return;
      }
      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
      res.end(data);
    });
  }

  return {
    /**
     * 静的ファイルとしてリクエストを処理する。server.js から呼ばれる。
     * @param {string} pathname デコード済み・クエリ除去済みのパス
     * @param {http.ServerResponse} res
     */
    serve(pathname, res) {
      const dir = publicDir();
      const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const normalized = path.normalize(path.join(dir, relativePath));

      // ディレクトリトラバーサル対策。public/ の外に出るパスは拒否する。
      // ブラウザはURLを正規化するため通常ここには来ないが、curl 等の
      // 正規化しないクライアントからプラグイン本体のコードや設定を守る（検証済み）
      if (!normalized.startsWith(dir + path.sep) && normalized !== dir) {
        ME.logger.log(`不正なパスを拒否しました: ${pathname}`);
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      sendFile(normalized, res, () => {
        // /assets/ 配下のアセットは無ければ 404（Simple Eagle と同じ）
        if (pathname.startsWith('/assets/')) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }
        // それ以外は SPA のルーティングとみなして index.html を返す
        sendFile(path.join(dir, 'index.html'), res, () => {
          ME.logger.error('public/index.html がありません。フロントエンドが未配置です');
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
        });
      });
    },
  };
})();
