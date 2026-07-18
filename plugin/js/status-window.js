/**
 * ステータスウィンドウの UI ロジック（backend/status-window.md）。
 *
 * このモジュールはプラグインのレンダラー内で完結し、HTTP を経由しない
 * （eagle.* と ME.* を直接呼ぶ）。デザインはモック（Eagle Server.dc.html）に準拠するが、
 * 外部リソースは使わない（アイコンはインライン SVG、QR はローカル qrcode、テーマはダーク固定）。
 *
 * 【Step 1（本コミット）】表示系のみ:
 *   状態表示・ログ表示/クリア・IP 列挙・QR 初期生成・アクセス URL 表示/コピー。
 * 【Step 2（次コミット）】制御系: トグル・共通保存ボタン・パスワード可視切替・
 *   起動時復元/リトライ/IP 不在ウィンドウ。
 */

window.ME = window.ME || {};

ME.statusWindow = (() => {
  const os = require('os');

  // qrcode はピュア JS の npm モジュール（検証済み T4）。念のため require を保護する。
  let QRCode = null;
  try {
    QRCode = require('qrcode');
  } catch (err) {
    ME.logger.error('qrcode モジュールの読み込みに失敗しました', err);
  }

  // Material Icons 相当のパス（24x24）。外部フォントを使わずインライン SVG で描く。
  const ICON_PATHS = {
    content_copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    expand_more: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    visibility: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    visibility_off: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
    save: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
    delete_sweep: 'M15 16h4v2h-4v-2zm0-8h7v2h-7V8zm0 4h6v2h-6v-2zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12V5z',
    // 停止中の QR プレースホルダ（QR 風の簡易パターン）
    qr_code_2: 'M3 3h6v6H3V3zm2 2v2h2V5H5zm10-2h6v6h-6V3zm2 2v2h2V5h-2zM3 15h6v6H3v-6zm2 2v2h2v-2H5zm14-2h2v2h-2v-2zm-8-8h2v2h-2V7zm0 4h2v2h-2v-2zm-4 0h2v2H7v-2zm8 0h2v2h-2v-2zm4 4h2v2h-2v-2zm-4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2z',
  };

  /** インライン SVG のマークアップを返す。 */
  function svg(name, size) {
    const path = ICON_PATHS[name] || '';
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${path}"></path></svg>`;
  }

  /** DOM 参照。init() で埋める。 */
  const el = {};

  /**
   * PC の全 IPv4（非ループバック）アドレスを列挙する。
   * ラベルによる種別区別は付けない（status-window.md 4.3。ユーザー決定）。
   * @returns {string[]}
   */
  function listIpAddresses() {
    const result = [];
    const interfaces = os.networkInterfaces();
    for (const addrs of Object.values(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family !== 'IPv4' || addr.internal) continue;
        result.push(addr.address);
      }
    }
    return result;
  }

  /** 現在の選択 IP を返す（未選択なら空文字）。 */
  function currentIp() {
    return el.ip ? el.ip.value : '';
  }

  /** 現在のポートを返す（入力欄。空なら設定値）。 */
  function currentPort() {
    const raw = (el.port && el.port.value) || '';
    return raw || String(ME.settings.get('port') || 8000);
  }

  /** アクセス URL を組み立てる。IP 未選択なら空文字。 */
  function currentUrl() {
    const ip = currentIp();
    if (!ip) return '';
    return `http://${ip}:${currentPort()}/`;
  }

  /** サーバー状態の表示を更新する（起動中/停止中/起動失敗）。 */
  function renderStatus() {
    const running = ME.server.isRunning();
    el.toggle.classList.toggle('on', running);

    // 失敗表示は「停止中かつ直近の操作が失敗」のときだけ。稼働中は必ず起動中表示にする。
    const mode = running ? 'running' : (statusMode === 'failed' ? 'failed' : 'stopped');
    const view = {
      running: { text: 'サーバー起動中', color: 'var(--ok)' },
      stopped: { text: 'サーバー停止中', color: 'var(--muted)' },
      failed: { text: 'サーバーの起動に失敗。詳細はログをご覧ください。', color: 'var(--err)' },
    }[mode];
    el.statusText.textContent = view.text;
    el.statusDot.style.background = view.color;
    el.status.style.color = view.color;
  }

  /** ログを描画する（logger は最新が先頭。表示は時系列で最新を末尾にしスクロール追従）。 */
  function renderLog(lines) {
    el.log.textContent = lines.slice().reverse().join('\n');
    el.log.scrollTop = el.log.scrollHeight;
  }

  /**
   * ログ更新のハンドラ。ログを再描画しつつ、サーバーの稼働状態変化を検知する。
   * サーバーの起動/停止は必ずログを伴う（server.js）ため、状態変化をここで捉えて
   * 状態表示・QR を更新する。init 時点ではまだ自動起動（onPluginCreate の非同期
   * server.start）が完了しておらず、トグルが OFF のまま固定される問題を防ぐ。
   */
  function handleLogUpdate(lines) {
    renderLog(lines);
    const running = ME.server.isRunning();
    if (running !== lastRunning) {
      lastRunning = running;
      renderStatus();
      renderUrl();
      renderQr();
    }
  }

  /** アクセス URL 表示を更新する。 */
  function renderUrl() {
    el.url.textContent = currentUrl() || '-';
  }

  /** QR コードを生成/更新する。停止中・IP 未選択・生成失敗時はプレースホルダを出す。 */
  async function renderQr() {
    const url = currentUrl();
    const canRender = QRCode && ME.server.isRunning() && url;
    if (!canRender) {
      showQrPlaceholder();
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
      el.qr.src = dataUrl;
      el.qr.hidden = false;
      el.qrPh.hidden = true;
    } catch (err) {
      ME.logger.error('QR コードの生成に失敗しました', err);
      showQrPlaceholder();
    }
  }

  function showQrPlaceholder() {
    el.qr.hidden = true;
    el.qr.removeAttribute('src');
    el.qrPh.hidden = false;
  }

  /** IP ドロップダウンを構築し、保存済み selectedIp（無ければ先頭）を選択する。 */
  function buildIpOptions() {
    const addresses = listIpAddresses();
    const saved = ME.settings.get('selectedIp');
    el.ip.innerHTML = '';

    if (addresses.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '（外部 IP が見つかりません）';
      el.ip.appendChild(opt);
      return;
    }

    for (const address of addresses) {
      const opt = document.createElement('option');
      opt.value = address;
      opt.textContent = address;
      el.ip.appendChild(opt);
    }
    el.ip.value = addresses.includes(saved) ? saved : addresses[0];
  }

  /** サーバー操作の実行中フラグ（トグル・保存の二重実行防止）。 */
  let busy = false;
  /** 直近の起動/再起動操作が失敗したか（状態表示に使う）。 */
  let statusMode = null;
  /** 直近に描画したサーバー稼働状態（ログ更新から状態変化を検知するため）。 */
  let lastRunning = null;

  /** タイマー（コピー表示のリセット用）。 */
  let copyTimer = null;
  /** 保存ボタンのフィードバック用タイマー。 */
  let saveTimer = null;

  /** アクセス URL をクリップボードへコピーする。 */
  function copyUrl() {
    const url = currentUrl();
    if (!url) return;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(url);
    } catch (err) {
      ME.logger.error('URL のコピーに失敗しました', err);
    }
    el.copyIcon.innerHTML = svg('check', 18);
    el.copyIcon.style.color = 'var(--ok)';
    el.copyHint.textContent = 'コピーしました';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      el.copyIcon.innerHTML = svg('content_copy', 18);
      el.copyIcon.style.color = 'var(--muted)';
      el.copyHint.textContent = 'クリックするとクリップボードにコピーされます';
    }, 1600);
  }

  /** トグル・保存ボタンの実行中表示（二重実行防止。grid の楽観的更新と同じ割り切り）。 */
  function setBusy(b) {
    busy = b;
    for (const btn of [el.toggle, el.save]) {
      btn.style.opacity = b ? '0.5' : '';
      btn.style.pointerEvents = b ? 'none' : '';
    }
  }

  /** サーバー ON/OFF トグル（即時反映。設定に serverEnabled を保存する）。 */
  async function onToggleServer() {
    if (busy) return;
    setBusy(true);
    try {
      if (ME.server.isRunning()) {
        await ME.server.stop();
        ME.settings.set({ serverEnabled: false });
        statusMode = null;
      } else {
        await ME.server.start(Number(ME.settings.get('port')) || 8000);
        ME.settings.set({ serverEnabled: true });
        statusMode = null;
      }
    } catch (err) {
      // 起動失敗のダイアログは server.js が担当（4.6）。ここは状態表示のみ更新する。
      statusMode = 'failed';
    } finally {
      setBusy(false);
      renderStatus();
      renderUrl();
      renderQr();
    }
  }

  /** パスワードが制約（英数記号のみ・0〜128 文字）を満たすか。 */
  function isValidPassword(pw) {
    return pw.length <= 128 && /^[\x21-\x7e]*$/.test(pw);
  }

  /** 保存ボタンのフィードバック（一時的に「保存しました」）。 */
  function saveFeedback() {
    el.saveIcon.innerHTML = svg('check', 18);
    el.saveLabel.textContent = '保存しました';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      el.saveIcon.innerHTML = svg('save', 18);
      el.saveLabel.textContent = '保存';
    }, 1600);
  }

  /**
   * 共通保存ボタン（status-window.md 4.8）。
   * IP・ポート・パスワードをまとめて保存し、ポート変更時は稼働中なら再起動、QR を再生成する。
   */
  async function onSave() {
    if (busy) return;

    const ip = currentIp();
    const portNum = Number(el.port.value);
    const password = el.pw.value;

    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      ME.logger.log('ポート番号が不正です（1〜65535）。保存しませんでした');
      return;
    }
    if (!isValidPassword(password)) {
      ME.logger.log('パスワードが不正です（英数記号のみ・最大128文字）。保存しませんでした');
      return;
    }

    setBusy(true);
    try {
      const portChanged = portNum !== Number(ME.settings.get('port'));
      ME.settings.set({ selectedIp: ip, port: portNum, password });

      // ポートが変わっていて稼働中なら再起動する（停止中は保存のみ。次回 ON 時に反映）。
      if (portChanged && ME.server.isRunning()) {
        await ME.server.stop();
        await ME.server.start(portNum);
      }
      statusMode = null;
      ME.logger.log(
        `設定を保存しました (${ip || 'IPなし'}:${portNum}`
        + `${password ? ' / パスワード認証あり' : ' / パスワード認証なし'})`,
      );
      saveFeedback();
    } catch (err) {
      // 再起動失敗のダイアログは server.js が担当（4.6）。
      statusMode = 'failed';
    } finally {
      setBusy(false);
      renderStatus();
      renderUrl();
      renderQr();
    }
  }

  /** パスワードの可視/不可視を切り替える。 */
  function togglePassword() {
    const show = el.pw.type === 'password';
    el.pw.type = show ? 'text' : 'password';
    el.pwIcon.innerHTML = svg(show ? 'visibility_off' : 'visibility', 20);
  }

  /** IP を再列挙してドロップダウン・URL・QR を更新する。 */
  function refreshIpOptions() {
    buildIpOptions();
    renderUrl();
    renderQr();
  }

  /**
   * 起動時の IP 不在チェック（status-window.md 5 章・9 章）。
   * Tailscale の utun* は起動直後に未出現のことがあるため、猶予後に再列挙する
   * （main.js の isBootstrapping 猶予 3 秒に合わせる。この頃には onPluginRun の
   *  自動 hide も終わっているため window.show() が打ち消されない）。
   * サーバー ON 設定なのにアクセス用 IP が無ければウィンドウを開いて再選択を促す。
   */
  function checkIpAvailabilityAfterBoot() {
    setTimeout(() => {
      refreshIpOptions();
      if (!ME.settings.get('serverEnabled')) return;
      const addresses = listIpAddresses();
      const saved = ME.settings.get('selectedIp');
      const missing = addresses.length === 0 || (saved && !addresses.includes(saved));
      if (missing && typeof eagle !== 'undefined') {
        ME.logger.log('アクセス用 IP が見つかりません。IP を選び直してください');
        eagle.window.show();
      }
    }, 3000);
  }

  /** 静的なアイコンを差し込む。 */
  function insertStaticIcons() {
    el.copyIcon.innerHTML = svg('content_copy', 18);
    el.ipCaret.innerHTML = svg('expand_more', 20);
    el.pwIcon.innerHTML = svg('visibility', 20);
    el.saveIcon.innerHTML = svg('save', 18);
    el.clearIcon.innerHTML = svg('delete_sweep', 15);
    el.qrPh.innerHTML = svg('qr_code_2', 52);
  }

  function cacheElements() {
    el.toggle = document.getElementById('sw-toggle');
    el.status = document.getElementById('sw-status');
    el.statusDot = document.getElementById('sw-status-dot');
    el.statusText = document.getElementById('sw-status-text');
    el.qr = document.getElementById('sw-qr');
    el.qrPh = document.getElementById('sw-qr-ph');
    el.copy = document.getElementById('sw-copy');
    el.url = document.getElementById('sw-url');
    el.copyIcon = document.getElementById('sw-copy-icon');
    el.copyHint = document.getElementById('sw-copy-hint');
    el.ip = document.getElementById('sw-ip');
    el.ipCaret = document.getElementById('sw-ip-caret');
    el.port = document.getElementById('sw-port');
    el.pw = document.getElementById('sw-pw');
    el.pwToggle = document.getElementById('sw-pw-toggle');
    el.pwIcon = document.getElementById('sw-pw-icon');
    el.save = document.getElementById('sw-save');
    el.saveIcon = document.getElementById('sw-save-icon');
    el.saveLabel = document.getElementById('sw-save-label');
    el.clear = document.getElementById('sw-clear');
    el.clearIcon = document.getElementById('sw-clear-icon');
    el.log = document.getElementById('sw-log');
  }

  function init() {
    cacheElements();
    insertStaticIcons();

    // 設定の初期値を入力欄へ反映する（変更の確定は Step 2 の保存ボタン）。
    el.port.value = String(ME.settings.get('port') || 8000);
    el.pw.value = ME.settings.get('password') || '';
    buildIpOptions();

    // イベント結線。
    el.copy.addEventListener('click', copyUrl);
    el.clear.addEventListener('click', () => ME.logger.clear());
    el.toggle.addEventListener('click', onToggleServer);
    el.save.addEventListener('click', onSave);
    el.pwToggle.addEventListener('click', togglePassword);
    // ポートは数字のみ 5 桁、パスワードは英数記号のみ 128 文字に整える（確定は保存ボタン）。
    el.port.addEventListener('input', () => {
      el.port.value = el.port.value.replace(/\D/g, '').slice(0, 5);
    });
    el.pw.addEventListener('input', () => {
      el.pw.value = el.pw.value.replace(/[^\x21-\x7e]/g, '').slice(0, 128);
    });

    // ログ更新を購読する（再描画に加え、サーバー状態変化を検知して表示・QR を更新する）。
    ME.logger.subscribe(handleLogUpdate);

    lastRunning = ME.server.isRunning();
    renderStatus();
    renderLog(ME.logger.getLines());
    renderUrl();
    renderQr();

    // 起動直後の IP 不在チェック（Tailscale utun* の遅延出現に対応。5 章・9 章）。
    checkIpAvailabilityAfterBoot();
  }

  return {
    init,
    // Step 2 以降・テスト用に表示更新を公開する。
    renderStatus,
    renderUrl,
    renderQr,
  };
})();

// 全モジュール読み込み後に初期化する（index.html で main.js より前に読み込む）。
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => ME.statusWindow.init());
}
