import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { TFilter } from '@/types';

// route（path + query）から表示コンテキストを導出する（base.md 7 章）。
// 現在フォルダ・フィルタ条件は store に持たず、URL を唯一の情報源にする。

// query の値は string | string[] | null を取り得るため、先頭の文字列だけを採用する。
const first = (v: unknown): string => {
  if (Array.isArray(v)) return v[0] == null ? '' : String(v[0]);
  return v == null ? '' : String(v);
};

// カンマ区切りの query を配列にする。空要素は落とす。
const splitList = (v: unknown): string[] =>
  first(v)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

export function useRouteContext() {
  const route = useRoute();

  // 'all'（すべて）/ 'uncategorized'（未分類）/ 実フォルダ ID。
  const folderId = computed<string>(() => first(route.params.folderId) || 'all');

  const filter = computed<TFilter>(() => ({
    // 不正な値は捨てる（URL 直打ちでサーバーに壊れた条件を送らないため）。
    stars: splitList(route.query.stars)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 5),
    exts: splitList(route.query.exts).map((s) => s.toLowerCase()),
    keyword: first(route.query.keyword).trim(),
    tags: splitList(route.query.tags),
  }));

  // ヘッダーのフィルタボタンを「適用中」表示にする条件（grid.md 3.1）。
  const isFilterActive = computed<boolean>(() => {
    const f = filter.value;
    return f.stars.length > 0 || f.exts.length > 0 || f.tags.length > 0 || f.keyword !== '';
  });

  return { folderId, filter, isFilterActive };
}
