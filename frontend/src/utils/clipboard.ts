// クリップボードへのコピー（lightbox.md 6.4）。

/**
 * テキストをクリップボードへコピーする。成功したら true。
 *
 * **`navigator.clipboard` だけでは実機で動かない。**
 * Clipboard API は secure context（https / localhost）でしか使えず、
 * このアプリの実運用は Tailscale 経由の `http://100.x.x.x:8000` = 非セキュアなので
 * `navigator.clipboard` が undefined になる。PC の localhost では動くのに
 * スマホだけコピーできない、という分かりにくい差になるため必ず両方を持つ。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // secure context ではこちら。権限拒否などで失敗したらフォールバックに回す。
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // フォールバックへ
    }
  }
  return copyByExecCommand(text);
}

/**
 * 非推奨 API だが、非セキュアコンテキストで使える唯一の手段。
 *
 * iOS Safari 対策として 2 段構えにしている:
 *
 * 1. **`focus()` してから `setSelectionRange()` する。**
 *    フォーカスの無い要素に `setSelectionRange()` しても document の選択範囲は
 *    作られず、`execCommand('copy')` が**空の選択をコピーしてクリップボードを消す**
 *    （iPhone Safari で実際に踏んだ: ペーストしても何も出ず、コピー前の内容も消えた）
 * 2. **`copy` イベントで内容を直接差し込む。**
 *    選択範囲の作成に失敗しても、イベント側で `setData` すれば正しい文字列が入る。
 *    選択に依存しないため、1 が環境差で崩れても効く安全網。
 */
function copyByExecCommand(text: string): boolean {
  // 安全網。capture フェーズで奪い、選択内容によらず text を書き込む。
  const onCopy = (e: ClipboardEvent): void => {
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
  };
  document.addEventListener('copy', onCopy, true);

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // 画面外へ出す。`opacity: 0` で重ねるより確実で、iOS のスクロール飛びも起きにくい。
  // top を現在のスクロール位置に合わせるのは、フォーカス時に画面が跳ねるのを防ぐため。
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  textarea.style.top = `${window.scrollY}px`;
  // iOS はフォーカス時に 16px 未満の入力欄でズームする。
  textarea.style.fontSize = '16px';
  document.body.appendChild(textarea);

  try {
    // focus → setSelectionRange の順序が必須（上記 1）。
    textarea.focus();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.removeEventListener('copy', onCopy, true);
    document.body.removeChild(textarea);
  }
}
