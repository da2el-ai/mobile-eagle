// バックエンド（/api/eagle）への薄い fetch ラッパー（base.md 9 章）。
// フィルタはすべてサーバー側で行うため、クライアント側の絞り込みはしない。

import { API_BASE_URL, ITEM_GET_COUNT } from '@/env';
import { useSettings } from '@/composables/use-settings';
import type { TFilter, TFolderItem, TImageItem } from '@/types';

// 401 を表す専用エラー。認証ダイアログの再表示につなげる（auth.md 5 章で共通処理する）。
export class UnauthorizedError extends Error {
  constructor(message = '認証が必要です') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// 例外から表示用メッセージを取り出す（各 store の catch で使う）。
export function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '通信に失敗しました';
}

// レスポンスの共通形。status と（一覧・フォルダは）data を持つ。
interface ApiResponse<T> {
  status: string;
  data?: T;
  message?: string;
}

interface FoldersResponse extends ApiResponse<TFolderItem[]> {
  extList?: string[];
  uncategorizedCount?: number;
  totalCount?: number;
}

// JSON を取得する共通処理。response.ok と data.status の両方を確認し、失敗は throw する。
async function requestJson<T extends ApiResponse<unknown>>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);

  // 401 は共通処理（auth.md 5 章）。ボディに関係なく専用エラーにする。
  if (res.status === 401) throw new UnauthorizedError();

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    // JSON でない応答（サーバー障害・プロキシのエラーページ等）
    throw new Error(`不正な応答です（HTTP ${res.status}）`);
  }

  if (!res.ok || data.status === 'error') {
    throw new Error(data.message || `リクエストに失敗しました（HTTP ${res.status}）`);
  }
  return data;
}

// POST（JSON ボディ）の共通処理。
function postJson<T extends ApiResponse<unknown>>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// カンマ区切りの検索パラメータを組み立てる引数。
export interface FetchItemsParams {
  // 'all'（すべて）/ 'uncategorized'（未分類）/ 実フォルダ ID
  folderId: string;
  // ページ番号（スキップ件数 = offset × limit）。base.md 9 章
  offset: number;
  filter: TFilter;
  limit?: number;
}

// 画像一覧を取得する。フィルタは query に載せてサーバー側で絞り込ませる。
export async function fetchItems(params: FetchItemsParams): Promise<TImageItem[]> {
  const query = new URLSearchParams();
  query.set('limit', String(params.limit ?? ITEM_GET_COUNT));
  query.set('offset', String(params.offset));

  // 'all' は folders を付けない（全件）。'uncategorized' はそのまま渡す（バックエンドが特別扱い）。
  if (params.folderId && params.folderId !== 'all') {
    query.set('folders', params.folderId);
  }

  const { stars, exts, keyword, tags } = params.filter;
  if (stars.length > 0) query.set('stars', stars.join(','));
  if (exts.length > 0) query.set('ext', exts.join(','));
  if (tags.length > 0) query.set('tags', tags.join(','));
  if (keyword) query.set('keyword', keyword);

  const res = await requestJson<ApiResponse<TImageItem[]>>(`${API_BASE_URL}/list?${query}`);
  return res.data ?? [];
}

// フォルダ一覧（拡張レスポンス）を取得する（base.md 10 章）。
export async function fetchFolders(): Promise<{
  folders: TFolderItem[];
  extList: string[];
  uncategorizedCount: number;
  totalCount: number;
}> {
  const res = await requestJson<FoldersResponse>(`${API_BASE_URL}/folders`);
  return {
    folders: res.data ?? [],
    extList: res.extList ?? [],
    uncategorizedCount: res.uncategorizedCount ?? 0,
    totalCount: res.totalCount ?? 0,
  };
}

// アイテムを更新する。送るプロパティだけ（undefined は JSON 化で自動的に落ちる）。
export interface UpdateItemPatch {
  star?: number;
  tags?: string[];
  annotation?: string;
  url?: string;
}
export function updateItem(id: string, patch: UpdateItemPatch): Promise<ApiResponse<never>> {
  return postJson(`/update`, { id, ...patch });
}

// 選択アイテムをゴミ箱へ移動する。
export function moveToTrash(itemIds: string[]): Promise<ApiResponse<never>> {
  return postJson(`/move_to_trash`, { itemIds });
}

// 選択アイテムをフォルダへ移動する（置換）。folderId は実 ID または 'uncategorized'。
export function moveToFolder(itemIds: string[], folderId: string): Promise<ApiResponse<never>> {
  return postJson(`/move_to_folder`, { itemIds, folderId });
}

// サムネイル画像の URL を組み立てる（<img src> 用）。
export function thumbnailUrl(id: string): string {
  return `${API_BASE_URL}/get_thumbnail_image?id=${encodeURIComponent(id)}`;
}

// 拡大画像の URL を組み立てる。圧縮の閾値・品質は設定値を付与する（settings.md）。
export function imageUrl(id: string): string {
  const { effectiveMaxFileSize, effectiveQuality } = useSettings();
  const query = new URLSearchParams({
    id,
    max_file_size: String(effectiveMaxFileSize()),
    quality: String(effectiveQuality()),
  });
  return `${API_BASE_URL}/get_image?${query}`;
}
