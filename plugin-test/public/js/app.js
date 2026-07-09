/**
 * 静的配信テスト用のスクリプト。
 * ここはスマホのブラウザで動くので、Node.js の API や eagle オブジェクトは使えない。
 */

(() => {
  'use strict';

  let count = 0;

  const countEl = document.getElementById('count');
  const statusEl = document.getElementById('status');

  // JavaScript が読み込めたことを画面上に示す
  statusEl.textContent = 'JavaScript の読み込みに成功しました';
  statusEl.classList.add('ok');

  document.getElementById('btn-count').addEventListener('click', () => {
    count += 1;
    countEl.textContent = String(count);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    count = 0;
    countEl.textContent = '0';
  });

  // 接続先を表示する
  document.getElementById('info-host').textContent = location.host;

  // 同一オリジンのAPIが呼べるか確認する（本実装のAPI配信と同じ構成）
  fetch('/ping')
    .then((res) => res.json())
    .then((json) => {
      document.getElementById('info-ping').textContent = JSON.stringify(json);
    })
    .catch((err) => {
      document.getElementById('info-ping').textContent = `エラー: ${err.message}`;
    });
})();
