/**
 * Mobile Eagle Test
 * 概要.md の要検証事項（T1〜T7）を実機確認するためのテスト用プラグイン。
 */

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 状態
// ---------------------------------------------------------------------------

/** このインスタンスを識別するための情報。二重起動の判定に使う（T1） */
const instance = {
  id: Math.random().toString(36).slice(2, 8).toUpperCase(),
  startedAt: new Date(),
};

/** ライフサイクルイベントの受信回数（T1） */
const eventCounts = {
  onPluginCreate: 0,
  onPluginRun: 0,
  onPluginShow: 0,
  onPluginHide: 0,
  onPluginBeforeExit: 0,
  onLibraryChanged: 0,
};

/** ログの保持件数上限（本実装では直近200件の想定なので合わせる） */
const LOG_LIMIT = 200;

/** ログ行のバッファ。DOM構築前のログも取りこぼさないように配列で保持する */
const logLines = [];

/** T3 のHTTPサーバー。未起動なら null */
let server = null;

/**
 * 起動処理中かどうか。
 * Eagle 起動時は onPluginCreate の直後に onPluginRun が自動発火するため、
 * ユーザーのクリックによる onPluginRun と区別する必要がある。
 */
let isBootstrapping = true;

/** 起動時の自動 onPluginRun と判定する猶予時間（ミリ秒） */
const BOOTSTRAP_GRACE_MS = 3000;

// ---------------------------------------------------------------------------
// ログ
// ---------------------------------------------------------------------------

/**
 * ログを1行追加する。DOM未構築でも呼べる。
 * @param {string} message
 */
function log(message) {
  const now = new Date();
  const time = now.toLocaleTimeString('ja-JP', { hour12: false }) +
    '.' + String(now.getMilliseconds()).padStart(3, '0');
  logLines.unshift(`[${time}][${instance.id}] ${message}`);
  if (logLines.length > LOG_LIMIT) {
    logLines.length = LOG_LIMIT;
  }
  renderLog();
  console.log(`[MobileEagleTest] ${message}`);
}

/** ログをテキストエリアへ反映する（最新が上） */
function renderLog() {
  const el = document.getElementById('log');
  if (el) {
    el.value = logLines.join('\n');
  }
}

/**
 * 結果表示エリアを更新する。
 * @param {string} id 要素ID
 * @param {string} text 表示文字列
 * @param {'ok'|'ng'|null} status 色分け
 */
function setResult(id, text, status = null) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('ok', 'ng');
  if (status) el.classList.add(status);
}

/** T1 の結果表示を更新する */
function renderEventCounts() {
  setResult(
    't1-result',
    `イベント受信数: onPluginCreate=${eventCounts.onPluginCreate}` +
    ` / onPluginRun=${eventCounts.onPluginRun}` +
    ` / onPluginShow=${eventCounts.onPluginShow}` +
    ` / onPluginHide=${eventCounts.onPluginHide}` +
    ` / onLibraryChanged=${eventCounts.onLibraryChanged}\n` +
    `インスタンスID ${instance.id} は起動時刻 ${instance.startedAt.toLocaleString('ja-JP')} から不変であるべき`
  );
}

/** エラーオブジェクトを読める文字列にする */
function formatError(err) {
  if (!err) return '不明なエラー';
  return `${err.name || 'Error'}: ${err.message || String(err)}`;
}

/** バイト数を読みやすい単位にする */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// T1: ライフサイクル・二重起動確認
// ---------------------------------------------------------------------------

eagle.onPluginCreate((plugin) => {
  eventCounts.onPluginCreate += 1;
  log(`onPluginCreate: plugin=${plugin && plugin.manifest ? plugin.manifest.name : '?'}`);
  log(`インスタンス生成 id=${instance.id} startedAt=${instance.startedAt.toISOString()}`);
  renderEventCounts();

  // 起動直後の一定時間は「Eagle起動に伴う自動発火」とみなす
  setTimeout(() => {
    isBootstrapping = false;
    log(`起動処理の猶予時間(${BOOTSTRAP_GRACE_MS}ms)が終了。以降の onPluginRun はユーザー操作とみなす`);
  }, BOOTSTRAP_GRACE_MS);

  // サービスモードの検証なので、ウィンドウを開かずにサーバーを自動起動する（T3）
  startServer(getPort()).catch((err) => log(`サーバー自動起動に失敗: ${formatError(err)}`));
});

eagle.onPluginRun(() => {
  eventCounts.onPluginRun += 1;
  renderEventCounts();

  if (isBootstrapping) {
    // Eagle起動時は onPluginCreate 直後に onPluginRun が自動発火する。
    // ここで show() するとウィンドウが勝手に開いてしまうため、明示的に隠す。
    log('onPluginRun: 起動時の自動発火とみなしてウィンドウを表示しない（hide を実行）');
    eagle.window.hide();
    return;
  }

  // 常駐中にユーザーがクリックしたらウィンドウを表示する（本実装で採用予定の挙動）
  log('onPluginRun: ユーザー操作とみなしてウィンドウを表示する（既存インスタンスなら id が不変のはず）');
  eagle.window.show();
});

eagle.onPluginShow(() => {
  eventCounts.onPluginShow += 1;
  log('onPluginShow: ウィンドウ表示');
  renderEventCounts();
  refreshAll();
});

eagle.onPluginHide(() => {
  eventCounts.onPluginHide += 1;
  log('onPluginHide: ウィンドウ非表示（サービスは継続しているはず）');
  renderEventCounts();
});

eagle.onPluginBeforeExit(() => {
  eventCounts.onPluginBeforeExit += 1;
  log('onPluginBeforeExit: 終了前');
});

// ---------------------------------------------------------------------------
// T7: ライブラリ切り替え
// ---------------------------------------------------------------------------

eagle.onLibraryChanged((libraryPath) => {
  eventCounts.onLibraryChanged += 1;
  log(`onLibraryChanged: 新しいライブラリパス = ${libraryPath}`);
  renderEventCounts();
  setResult('t7-result', `onLibraryChanged を受信: ${libraryPath}\n「切り替え後の動作確認」を実行してください`);
});

/** 切り替え後もサーバーとプラグインAPIが動くか確認する */
async function checkAfterLibraryChange() {
  const lines = [];

  // /ping への疎通確認
  try {
    const res = await fetch(`http://127.0.0.1:${getPort()}/ping`);
    const json = await res.json();
    lines.push(`HTTPサーバー: OK (${JSON.stringify(json)})`);
  } catch (err) {
    lines.push(`HTTPサーバー: NG (${formatError(err)})`);
  }

  // プラグインAPIが新ライブラリのデータを返すか確認
  try {
    const libraryPath = eagle.library.path;
    const items = await eagle.item.get({});
    lines.push(`eagle.library.path: ${libraryPath}`);
    lines.push(`eagle.item.get({}): ${items.length} 件`);
    if (items.length > 0) {
      lines.push(`先頭アイテム: ${items[0].name}.${items[0].ext}`);
    }
  } catch (err) {
    lines.push(`プラグインAPI: NG (${formatError(err)})`);
  }

  const text = lines.join('\n');
  setResult('t7-result', text, text.includes('NG') ? 'ng' : 'ok');
  log(`T7 動作確認:\n${text}`);
}

// ---------------------------------------------------------------------------
// T2: 非表示中のダイアログ・通知の挙動
// ---------------------------------------------------------------------------

const T2_DELAY_MS = 10000;

/**
 * 10秒後に指定の通知手段を実行する。
 * その間にウィンドウを隠して挙動を観察する。
 * @param {'alert'|'messageBox'|'notification'} kind
 */
function scheduleT2(kind) {
  log(`T2[${kind}]: ${T2_DELAY_MS / 1000}秒後に実行します。今すぐウィンドウを隠してください`);
  setResult('t2-result', `${kind} を ${T2_DELAY_MS / 1000} 秒後に実行します…`);

  setTimeout(async () => {
    log(`T2[${kind}]: 実行開始（ウィンドウ表示状態=${eagle.window.isVisible ? eagle.window.isVisible() : '不明'}）`);
    try {
      if (kind === 'alert') {
        // 非表示のレンダラーでダイアログが出るかを確認する
        alert('T2: alert() のテストです。これが見えていれば非表示中でも表示されます。');
        log('T2[alert]: alert() から復帰しました（ユーザーがOKを押した）');
      } else if (kind === 'messageBox') {
        const result = await eagle.dialog.showMessageBox({
          type: 'warning',
          title: 'Mobile Eagle Test',
          message: 'T2: showMessageBox() のテストです',
          detail: 'これが見えていれば非表示中でもモーダルを出せます。',
          buttons: ['OK'],
        });
        log(`T2[messageBox]: 復帰しました result=${JSON.stringify(result)}`);
      } else if (kind === 'notification') {
        await eagle.notification.show({
          title: 'Mobile Eagle Test',
          body: 'T2: notification.show() のテストです（自動で消えます）',
          mute: false,
          duration: 5000,
        });
        log('T2[notification]: OS通知を表示しました');
      }
      setResult('t2-result', `${kind}: 実行完了。ログと画面の挙動を確認してください`, 'ok');
    } catch (err) {
      log(`T2[${kind}]: エラー ${formatError(err)}`);
      setResult('t2-result', `${kind}: エラー ${formatError(err)}`, 'ng');
    }
  }, T2_DELAY_MS);
}

// ---------------------------------------------------------------------------
// T3: HTTPサーバー・外部アクセス
// ---------------------------------------------------------------------------

/** 入力欄のポート番号を取得する（不正値なら8000） */
function getPort() {
  const el = document.getElementById('t3-port');
  const port = el ? Number(el.value) : 8000;
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 8000;
}

/**
 * HTTPサーバーを 0.0.0.0 で起動する。
 * @param {number} port
 */
function startServer(port) {
  return new Promise((resolve, reject) => {
    if (server) {
      log('T3: サーバーは既に起動しています');
      resolve();
      return;
    }

    const srv = http.createServer((req, res) => {
      log(`T3: リクエスト受信 ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

      // クエリ・ハッシュを除いたパス部分だけを見る
      const pathname = decodeURIComponent(req.url.split('?')[0].split('#')[0]);

      if (pathname === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString(), instance: instance.id }));
        return;
      }

      if (pathname === '/hello') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>Mobile Eagle Test</title></head>' +
          '<body style="font-family:sans-serif;text-align:center;padding:40px">' +
          '<h1>Mobile Eagle Test</h1>' +
          `<p>接続に成功しました。</p><p>instance: ${instance.id}</p>` +
          `<p>${new Date().toLocaleString('ja-JP')}</p>` +
          '</body></html>'
        );
        return;
      }

      // それ以外は public/ 配下の静的ファイルとして配信する（T8）
      serveStatic(pathname, res);
    });

    // ポート使用中などの起動エラーを捕捉する
    srv.once('error', (err) => {
      server = null;
      log(`T3: サーバー起動エラー ${formatError(err)}`);
      setResult('t3-result', `起動エラー: ${formatError(err)}`, 'ng');
      reject(err);
    });

    srv.listen(port, '0.0.0.0', () => {
      server = srv;
      log(`T3: サーバー起動 0.0.0.0:${port}`);
      updateServerResult();
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// T8: 静的ファイル配信（HTML / CSS / JS）
// ---------------------------------------------------------------------------

/** 拡張子から Content-Type を引く */
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
  '.woff2': 'font/woff2',
};

/**
 * index.html の場所からプラグインルートを導出する。
 * __dirname が Eagle 本体のパスを指す場合の保険。
 * @returns {string|null}
 */
function pluginRootFromLocation() {
  try {
    if (!location.href.startsWith('file://')) return null;
    return path.dirname(decodeURIComponent(new URL(location.href).pathname));
  } catch (err) {
    return null;
  }
}

/**
 * プラグインのルートディレクトリを解決する。
 * .eagleplugin としてインストールされた後でもパスが取れるかを検証する。
 * @returns {string}
 */
function resolvePluginRoot() {
  // 1. eagle.plugin.path が使えるならそれを優先する
  if (typeof eagle !== 'undefined' && eagle.plugin && eagle.plugin.path) {
    return eagle.plugin.path;
  }
  // 2. index.html の場所から導出する
  const fromLocation = pluginRootFromLocation();
  if (fromLocation) return fromLocation;

  // 3. 最後の手段。このスクリプトが置かれた js/ の親ディレクトリ
  return path.resolve(__dirname, '..');
}

/** public/ ディレクトリの絶対パス */
function getPublicDir() {
  return path.join(resolvePluginRoot(), 'public');
}

/**
 * public/ 配下の静的ファイルを配信する。
 * @param {string} pathname リクエストパス（デコード済み・クエリ除去済み）
 * @param {http.ServerResponse} res
 */
function serveStatic(pathname, res) {
  const publicDir = getPublicDir();
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(publicDir, relativePath);

  // ディレクトリトラバーサル対策。public/ の外に出るパスは拒否する
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(publicDir + path.sep) && normalized !== publicDir) {
    log(`T8: 不正なパスを拒否 ${pathname}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(normalized, (err, data) => {
    if (err) {
      log(`T8: ファイルが見つかりません ${normalized} (${err.code})`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const contentType = MIME_TYPES[path.extname(normalized).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
    res.end(data);
    log(`T8: 配信 ${pathname} → ${contentType} (${data.length} bytes)`);
  });
}

/** T8 の結果欄に、配信元パスと存在確認の結果を表示する */
function updateStaticResult() {
  const publicDir = getPublicDir();
  const lines = [];

  // パス解決の3つの候補をすべて記録する（.eagleplugin 化した後の挙動確認のため）
  lines.push(`eagle.plugin.path: ${(typeof eagle !== 'undefined' && eagle.plugin && eagle.plugin.path) || '（取得できず）'}`);
  lines.push(`location由来: ${pluginRootFromLocation() || '（取得できず）'}`);
  lines.push(`__dirname由来: ${path.resolve(__dirname, '..')}`);
  lines.push(`→ 採用: ${resolvePluginRoot()}`);
  lines.push(`配信元ディレクトリ: ${publicDir}`);

  // 配信対象のファイルが実在するか確認する
  const targets = ['index.html', 'css/style.css', 'js/app.js'];
  let allExist = true;
  for (const target of targets) {
    const exists = fs.existsSync(path.join(publicDir, target));
    if (!exists) allExist = false;
    lines.push(`  ${exists ? '○' : '×'} ${target}`);
  }

  if (server) {
    const select = document.getElementById('t3-ip');
    const ip = select && select.value ? select.value : 'localhost';
    lines.push(`\n配信URL: http://${ip}:${getPort()}/`);
  } else {
    lines.push('\nサーバーが停止しています（T3で起動してください）');
  }

  setResult('t8-result', lines.join('\n'), allExist ? 'ok' : 'ng');
}

// ---------------------------------------------------------------------------

/** HTTPサーバーを停止する */
function stopServer() {
  if (!server) {
    log('T3: サーバーは起動していません');
    return;
  }
  server.close(() => log('T3: サーバー停止'));
  server = null;
  setResult('t3-result', 'サーバー停止中');
}

/** サーバーの状態と接続先URLを表示する */
function updateServerResult() {
  if (!server) {
    setResult('t3-result', 'サーバー停止中');
    return;
  }
  const port = getPort();
  const urls = listIpAddresses().map((ip) => `  http://${ip.address}:${port}/ping  (${ip.name})`);
  setResult(
    't3-result',
    `サーバー稼働中 0.0.0.0:${port}\n接続先候補:\n  http://localhost:${port}/ping  (localhost)\n${urls.join('\n')}`,
    'ok'
  );
}

/**
 * PCの全IPv4アドレスを列挙する。
 * @returns {{name: string, address: string, label: string}[]}
 */
function listIpAddresses() {
  const result = [];
  const interfaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      // IPv4 かつループバック以外を対象にする
      if (addr.family !== 'IPv4' || addr.internal) continue;
      result.push({ name, address: addr.address, label: `${addr.address} (${name}${detectKind(addr.address)})` });
    }
  }
  return result;
}

/**
 * IPアドレスの種類を判定してラベルにする。
 * Tailscale は 100.64.0.0/10 の CGNAT レンジを使う。
 * @param {string} address
 */
function detectKind(address) {
  const octets = address.split('.').map(Number);
  if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return ' / Tailscale';
  if (octets[0] === 10) return ' / LAN';
  if (octets[0] === 192 && octets[1] === 168) return ' / LAN';
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return ' / LAN';
  return '';
}

/** IPアドレスのドロップダウンを再構築する */
function reloadIpList() {
  const select = document.getElementById('t3-ip');
  if (!select) return;

  const current = select.value;
  const addresses = listIpAddresses();
  select.innerHTML = '';

  for (const ip of addresses) {
    const option = document.createElement('option');
    option.value = ip.address;
    option.textContent = ip.label;
    select.appendChild(option);
  }

  if (addresses.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '（外部IPが見つかりません）';
    select.appendChild(option);
  }

  // 以前の選択を保つ。無ければ Tailscale を優先して選ぶ
  if (current && addresses.some((ip) => ip.address === current)) {
    select.value = current;
  } else {
    const tailscale = addresses.find((ip) => detectKind(ip.address) === ' / Tailscale');
    if (tailscale) select.value = tailscale.address;
  }

  log(`T3: IPアドレスを ${addresses.length} 件検出 [${addresses.map((ip) => ip.address).join(', ')}]`);
}

// ---------------------------------------------------------------------------
// T4: npmモジュール（qrcode）
// ---------------------------------------------------------------------------

/** 選択中のIP・ポートからURLを組み立ててQRコードを生成する */
async function generateQrCode() {
  const select = document.getElementById('t3-ip');
  const ip = select ? select.value : '';
  if (!ip) {
    setResult('t4-result', 'IPアドレスが選択されていません', 'ng');
    return;
  }

  const url = `http://${ip}:${getPort()}/`;

  try {
    // require() でピュアJSのnpmモジュールが読めるかの検証を兼ねる
    const QRCode = require('qrcode');
    log(`T4: require('qrcode') 成功 version=${require('qrcode/package.json').version}`);

    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    const img = document.getElementById('t4-qr-img');
    img.src = dataUrl;
    img.hidden = false;

    setResult('t4-result', `生成しました: ${url}\nスマホで読み取ってページが開けるか確認してください`, 'ok');
    log(`T4: QRコード生成 ${url}`);
  } catch (err) {
    setResult('t4-result', `エラー: ${formatError(err)}\nnpm install を実行しましたか？`, 'ng');
    log(`T4: エラー ${formatError(err)}`);
  }
}

// ---------------------------------------------------------------------------
// T5: Canvas によるリサイズ・JPEG圧縮
// ---------------------------------------------------------------------------

const T5_MAX_EDGE = 2048;
const T5_QUALITY = 0.85;

/** .webp をサイズ降順で取得し、リサイズ＋JPEG圧縮の時間を計測する */
async function runCanvasBenchmark() {
  const countEl = document.getElementById('t5-count');
  const count = countEl ? Number(countEl.value) : 5;
  const thumbs = document.getElementById('t5-thumbs');
  thumbs.innerHTML = '';

  setResult('t5-result', '実行中…');

  try {
    // eagle.item.get() には orderBy / limit が無いため、取得後にJS側でソートする
    const items = await eagle.item.get({ ext: 'webp' });
    log(`T5: .webp を ${items.length} 件取得`);

    if (items.length === 0) {
      setResult('t5-result', '.webp のアイテムが見つかりません', 'ng');
      return;
    }

    const targets = items
      .filter((item) => !item.isDeleted)
      .sort((a, b) => b.size - a.size)
      .slice(0, count);

    const lines = [];
    lines.push(`対象 ${targets.length} 件 / 長辺 ${T5_MAX_EDGE}px / JPEG品質 ${T5_QUALITY * 100}`);

    for (const item of targets) {
      const result = await compressItem(item);
      lines.push(
        `${item.name}.${item.ext} ${item.width}x${item.height} ${formatBytes(item.size)}\n` +
        `  読込 ${result.decodeMs}ms` +
        ` / Canvas ${result.canvasMs}ms → ${formatBytes(result.canvasBytes)}` +
        ` / Offscreen ${result.offscreenMs}ms → ${formatBytes(result.offscreenBytes)}`
      );
      log(`T5: ${item.name}.${item.ext} 読込${result.decodeMs}ms Canvas${result.canvasMs}ms Offscreen${result.offscreenMs}ms`);

      // 変換結果を目視確認するためサムネイル表示する
      const img = document.createElement('img');
      img.src = result.previewUrl;
      img.alt = item.name;
      thumbs.appendChild(img);
    }

    setResult('t5-result', lines.join('\n'), 'ok');
  } catch (err) {
    setResult('t5-result', `エラー: ${formatError(err)}`, 'ng');
    log(`T5: エラー ${formatError(err)}`);
  }
}

/**
 * 1アイテムをリサイズ＋JPEG圧縮し、通常Canvas と OffscreenCanvas の両方で計測する。
 * fetch() は file:// を扱えないため fs で読み込む。
 * @param {object} item
 */
async function compressItem(item) {
  // ファイル読み込み → ImageBitmap へデコード
  const decodeStart = performance.now();
  const buffer = fs.readFileSync(item.filePath);
  const blob = new Blob([buffer], { type: `image/${item.ext}` });
  const bitmap = await createImageBitmap(blob);
  const decodeMs = Math.round(performance.now() - decodeStart);

  // 長辺を T5_MAX_EDGE に収めるスケールを求める（拡大はしない）
  const scale = Math.min(1, T5_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  // 通常の Canvas
  const canvasStart = performance.now();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const canvasBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', T5_QUALITY));
  const canvasMs = Math.round(performance.now() - canvasStart);

  // OffscreenCanvas
  const offscreenStart = performance.now();
  const offscreen = new OffscreenCanvas(width, height);
  offscreen.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const offscreenBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: T5_QUALITY });
  const offscreenMs = Math.round(performance.now() - offscreenStart);

  bitmap.close();

  return {
    decodeMs,
    canvasMs,
    canvasBytes: canvasBlob.size,
    offscreenMs,
    offscreenBytes: offscreenBlob.size,
    previewUrl: URL.createObjectURL(canvasBlob),
  };
}

// ---------------------------------------------------------------------------
// T6: ゴミ箱アイテムの取得・フォルダ移動
// ---------------------------------------------------------------------------

/** ゴミ箱内のアイテムがプラグインAPIで取得できるか調べる */
async function testTrash() {
  setResult('t6-trash-result', '実行中…');
  const lines = [];

  try {
    // 通常の取得結果に isDeleted のアイテムが含まれるか
    const items = await eagle.item.get({});
    const deleted = items.filter((item) => item.isDeleted);
    lines.push(`eagle.item.get({}): 全 ${items.length} 件 / うち isDeleted=true は ${deleted.length} 件`);

    // getAll() でも同様に確認する
    if (typeof eagle.item.getAll === 'function') {
      const all = await eagle.item.getAll();
      const allDeleted = all.filter((item) => item.isDeleted);
      lines.push(`eagle.item.getAll(): 全 ${all.length} 件 / うち isDeleted=true は ${allDeleted.length} 件`);
    } else {
      lines.push('eagle.item.getAll(): 未提供');
    }

    // 検索条件に isDeleted を渡せるかを試す（ドキュメント未記載のため挙動を確認する）
    try {
      const byOption = await eagle.item.get({ isDeleted: true });
      lines.push(`eagle.item.get({isDeleted:true}): ${byOption.length} 件（うち実際に isDeleted=true は ${byOption.filter((i) => i.isDeleted).length} 件）`);
    } catch (err) {
      lines.push(`eagle.item.get({isDeleted:true}): エラー ${formatError(err)}`);
    }

    // ゴミ箱フォルダが folder API に現れるか
    const folders = await eagle.folder.getAll();
    lines.push(`eagle.folder.getAll(): ${folders.length} 件（ゴミ箱相当のフォルダがあるか確認）`);

    const text = lines.join('\n');
    setResult('t6-trash-result', text, 'ok');
    log(`T6 ゴミ箱取得テスト:\n${text}`);
  } catch (err) {
    setResult('t6-trash-result', `エラー: ${formatError(err)}`, 'ng');
    log(`T6: ゴミ箱取得テストでエラー ${formatError(err)}`);
  }
}

/** フォルダ一覧のドロップダウンを再構築する */
async function reloadFolderList() {
  const select = document.getElementById('t6-folder');
  if (!select) return;

  try {
    const folders = await eagle.folder.getAll();
    select.innerHTML = '';

    // 階層は無視してフラットに並べる（検証用のため）
    const flatten = (list, depth = 0) => {
      for (const folder of list) {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = `${'　'.repeat(depth)}${folder.name}`;
        select.appendChild(option);
        if (folder.children && folder.children.length > 0) {
          flatten(folder.children, depth + 1);
        }
      }
    };
    flatten(folders);

    log(`T6: フォルダを ${select.options.length} 件取得`);
  } catch (err) {
    log(`T6: フォルダ取得エラー ${formatError(err)}`);
  }
}

/** Eagle本体で選択中のアイテムを、選択したフォルダへ移動する */
async function testMoveFolder() {
  const select = document.getElementById('t6-folder');
  const folderId = select ? select.value : '';
  if (!folderId) {
    setResult('t6-move-result', '移動先フォルダが選択されていません', 'ng');
    return;
  }

  setResult('t6-move-result', '実行中…');

  try {
    const selected = await eagle.item.getSelected();
    if (!selected || selected.length === 0) {
      setResult('t6-move-result', 'Eagle本体でアイテムを選択してから実行してください', 'ng');
      return;
    }

    const lines = [];
    for (const item of selected) {
      const before = JSON.stringify(item.folders);
      // folders は読み書き可能なプロパティ。書き換えて save() する
      item.folders = [folderId];
      await item.save();
      lines.push(`${item.name}.${item.ext}: ${before} → ${JSON.stringify(item.folders)}`);
    }

    // 保存後に取得し直して、実際に反映されたか確認する
    const verified = await eagle.item.getById(selected[0].id);
    lines.push(`再取得して確認: ${verified.name} の folders = ${JSON.stringify(verified.folders)}`);
    lines.push('Eagle本体の表示でも移動されているか目視確認してください');

    const text = lines.join('\n');
    setResult('t6-move-result', text, 'ok');
    log(`T6 フォルダ移動テスト:\n${text}`);
  } catch (err) {
    setResult('t6-move-result', `エラー: ${formatError(err)}`, 'ng');
    log(`T6: フォルダ移動でエラー ${formatError(err)}`);
  }
}

// ---------------------------------------------------------------------------
// 初期化
// ---------------------------------------------------------------------------

/** ウィンドウ表示のたびに最新状態へ更新する */
function refreshAll() {
  reloadIpList();
  updateServerResult();
  updateStaticResult();
  reloadFolderList();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('instance-id').textContent = instance.id;
  document.getElementById('started-at').textContent = instance.startedAt.toLocaleString('ja-JP');

  // ログ
  document.getElementById('btn-clear-log').addEventListener('click', () => {
    logLines.length = 0;
    renderLog();
  });

  // T1
  document.getElementById('btn-t1-hide').addEventListener('click', () => eagle.window.hide());

  // T2
  document.getElementById('btn-t2-alert').addEventListener('click', () => scheduleT2('alert'));
  document.getElementById('btn-t2-messagebox').addEventListener('click', () => scheduleT2('messageBox'));
  document.getElementById('btn-t2-notification').addEventListener('click', () => scheduleT2('notification'));

  // T3
  document.getElementById('btn-t3-start').addEventListener('click', () => {
    startServer(getPort()).catch(() => { /* エラーは startServer 内で表示済み */ });
  });
  document.getElementById('btn-t3-stop').addEventListener('click', stopServer);
  document.getElementById('btn-t3-reload-ip').addEventListener('click', reloadIpList);

  // T4
  document.getElementById('btn-t4-qr').addEventListener('click', generateQrCode);

  // T5
  document.getElementById('btn-t5-run').addEventListener('click', runCanvasBenchmark);

  // T6
  document.getElementById('btn-t6-trash').addEventListener('click', testTrash);
  document.getElementById('btn-t6-reload-folder').addEventListener('click', reloadFolderList);
  document.getElementById('btn-t6-move').addEventListener('click', testMoveFolder);

  // T7
  document.getElementById('btn-t7-check').addEventListener('click', checkAfterLibraryChange);

  // T8
  document.getElementById('btn-t8-check').addEventListener('click', updateStaticResult);
  document.getElementById('btn-t8-open').addEventListener('click', () => {
    if (!server) {
      setResult('t8-result', 'サーバーが停止しています（T3で起動してください）', 'ng');
      return;
    }
    const url = `http://localhost:${getPort()}/`;
    log(`T8: 既定のブラウザで開く ${url}`);
    eagle.shell.openExternal(url);
  });

  renderLog();
  renderEventCounts();
  refreshAll();
  log('DOM構築完了');
});
