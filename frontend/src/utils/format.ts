// 表示用のフォーマッタ（lightbox.md 6 章）。

const pad = (n: number): string => String(n).padStart(2, '0');

// バイト数を `1,234 KB` 形式にする（lightbox.md の表示仕様）。
export function formatSizeKB(bytes: number): string {
  return `${Math.round(bytes / 1024).toLocaleString()} KB`;
}

// `yyyy/MM/dd hh:mm:ss` にする。
// 引数は**ミリ秒**（プラグイン API の modifiedAt。backend/base.md 8.1 で実測確認済み）。
// 移植元 Simple Eagle の formatDate は秒と見なして 1000 倍していたが、
// プラグイン API ではミリ秒なので流用すると数万年後の日付になる。
export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const date = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
