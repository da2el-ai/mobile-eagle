/**
 * パスワード認証（backend/auth.md）。
 *
 * server.js の前段フックに差し込み、/api/eagle/* を保護する。
 * - localhost からのアクセスは免除（Eagle Web API と同方針）
 * - パスワード未設定（空文字）なら認証無効
 * - トークンは決定的（SHA-256(password + 固定ソルト)）。パスワード変更で
 *   既存 Cookie が全端末で自動失効する（Eagle 再起動をまたいでも Cookie は有効）
 */

window.ME = window.ME || {};

ME.auth = (() => {
  const crypto = require('crypto');

  // 決定的トークンのソルト。トークンはパスワード等価の秘密情報なので
  // ログ・QR・レスポンスボディには出さない（backend/auth.md 4 章）。
  const SALT = 'mobile-eagle-auth-v1';
  const COOKIE_NAME = 'me_auth';
  const MAX_AGE = 2592000; // 30 日（秒）
  const MAX_BODY_BYTES = 4096; // login のボディ上限（パスワードのみなので小さい）

  /** 決定的トークン = SHA-256(password + SALT) の hex。 */
  function tokenFor(password) {
    return crypto.createHash('sha256').update(password + SALT).digest('hex');
  }

  /** タイミングセーフな文字列比較（長さ不一致は先に弾く）。 */
  function safeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /** Cookie ヘッダーを自前でパースする（依存パッケージを増やさない）。 */
  function parseCookies(header) {
    const out = {};
    if (!header) return out;
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
    return out;
  }

  /**
   * localhost からのアクセスか（認証免除の判定。backend/auth.md 4 章）。
   * 条件（AND）: remoteAddress が 127.0.0.1 かつ、X-Forwarded-For が無い/すべて localhost。
   * サーバーは 0.0.0.0（IPv4）バインドのため ::1 等の考慮は不要。
   * XFF は免除を打ち消す方向にのみ使う（リモートが偽装しても条件1を満たせず免除は得られない）。
   */
  function isLocalhost(req) {
    if (req.socket.remoteAddress !== '127.0.0.1') return false;
    const xff = req.headers['x-forwarded-for'];
    if (!xff) return true;
    return xff.split(',').map((s) => s.trim()).every(
      (ip) => ip === '127.0.0.1' || ip === '::1' || ip === 'localhost',
    );
  }

  /** 現在のパスワード（未設定なら空文字 = 認証無効）。リクエストごとに読む（設定変更が即反映）。 */
  function currentPassword() {
    return ME.settings.get('password') || '';
  }

  /** リクエストがアクセス許可されるか（認証無効・localhost 免除・有効 Cookie のいずれか）。 */
  function isAuthorized(req) {
    const password = currentPassword();
    if (!password) return true;
    if (isLocalhost(req)) return true;
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    return !!token && safeEqual(token, tokenFor(password));
  }

  /**
   * 前段フック（server.js が全リクエストの前に呼ぶ）。
   * 保護対象は /api/eagle/* のみ。true=続行 / false=フック側で 401 応答済み。
   */
  function beforeRequest(req, res) {
    const pathname = (req.url || '').split('?')[0];
    // /api/auth/*・/api/ping・静的配信（SPA 本体）は認証不要（backend/auth.md 5.3）
    if (!pathname.startsWith('/api/eagle/')) return true;
    if (isAuthorized(req)) return true;

    // 未認証アクセスは軽微エラーとしてログに記録する（coding.md 9 章）
    ME.logger.log(`未認証アクセスを拒否しました: ${pathname} from ${req.socket.remoteAddress}`);
    ME.server.sendJson(res, 401, { status: 'error', message: '認証が必要です' }, req);
    return false;
  }

  /** login の JSON ボディを読む（小さいので簡易実装）。 */
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          req.pause();
          reject(ME.server.badRequest('リクエストボディが大きすぎます'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('error', reject);
      req.on('end', () => {
        if (chunks.length === 0) { resolve({}); return; }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(ME.server.badRequest('リクエストボディが不正な JSON です'));
        }
      });
    });
  }

  /** GET /api/auth/check — 認証状態を返す（認証不要。backend/auth.md 5.1）。 */
  function handleCheck(req, res) {
    const password = currentPassword();
    const local = isLocalhost(req);
    // authRequired: パスワードが設定されているか（localhost からは常に false）
    const authRequired = !!password && !local;
    // authenticated: 認証不要か、有効な Cookie を持つか
    const authenticated = !authRequired || isAuthorized(req);
    ME.server.sendJson(res, 200, { status: 'success', authRequired, authenticated }, req);
  }

  /** POST /api/auth/login — パスワード照合して Cookie を発行（認証不要。backend/auth.md 5.2）。 */
  async function handleLogin(req, res) {
    const body = await readBody(req);
    const password = currentPassword();

    // 認証無効時はログイン不要。成功として扱う（Cookie は発行しない）
    if (!password) {
      ME.server.sendJson(res, 200, { status: 'success' }, req);
      return;
    }

    if (!safeEqual(body.password || '', password)) {
      ME.server.sendJson(res, 401, { status: 'error', message: 'パスワードが間違っています' }, req);
      return;
    }

    const cookie = `${COOKIE_NAME}=${tokenFor(password)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
    res.setHeader('Set-Cookie', cookie);
    ME.server.sendJson(res, 200, { status: 'success' }, req);
  }

  return {
    /** 認証エンドポイントを登録し、前段フックを差し込む。 */
    register() {
      ME.server.addRoute('GET', '/api/auth/check', handleCheck);
      ME.server.addRoute('POST', '/api/auth/login', handleLogin);
      ME.server.setBeforeRequest(beforeRequest);
      ME.logger.log('認証を初期化しました');
    },
  };
})();
