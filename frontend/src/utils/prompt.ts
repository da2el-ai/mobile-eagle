// 生成 AI のメタデータ（A1111 方式）を annotation から取り出す（lightbox.md 6.4）。

// A1111 のメタデータはポジティブプロンプトの後に「Negative prompt:」で始まる行が続く。
// 実データで確認した形（2026-07-30、ライブラリ 20,967 件中 19,236 件が該当）:
//
//   masterpiece, best quality, \n2girls, \n\n...\n\n\n\nNegative prompt:sepia, score_1, \n...
//
// - ポジティブプロンプト自体に改行・空行が含まれる（1 行前提にしないこと）
// - 「Negative prompt:」はコロン直後にスペースが**無い**ことがある
// - 行頭に限定する。プロンプト本文中にたまたま同じ語が出ても誤判定しないため
const NEGATIVE_PROMPT_DELIMITER = /^[ \t]*Negative prompt[ \t]*:/im;

/**
 * annotation からポジティブプロンプトを取り出す。
 * A1111 方式の書式に該当しなければ null を返す（＝コピーボタンを出さない）。
 */
export function extractPositivePrompt(annotation: string): string | null {
  if (!annotation) return null;

  const match = NEGATIVE_PROMPT_DELIMITER.exec(annotation);
  if (!match) return null;

  const positive = annotation.slice(0, match.index).trim();
  // 区切りはあるがポジティブ側が空、というケースはコピーする意味が無い。
  return positive === '' ? null : positive;
}
