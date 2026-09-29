// バックエンドのレスポンス互換の型（backend/base.md 8.1）。

// 画像アイテム。選択状態はここに持たせず selection store の Set で管理する（base.md 8 章）。
export interface TImageItem {
  id: string;
  name: string;
  size: number;
  ext: string;
  tags: string[];
  folders: string[];
  annotation: string;
  url: string;
  width: number;
  height: number;
  // 評価。未設定はバックエンドが 0 を返す。
  star: number;
  // プラグイン API の modifiedAt。modificationTime と lastModified は同値になる。
  modificationTime: number;
  lastModified: number;
}

// フォルダ。件数の合算は getter で行い、imageCount は直下の件数のまま保持する（folder-tree.md 4 章）。
export interface TFolderItem {
  id: string;
  name: string;
  children: TFolderItem[];
  imageCount: number;
}

// フィルタ条件（route query と相互変換する）。
export interface TFilter {
  stars: number[];
  exts: string[];
  keyword: string;
  tags: string[];
}

// ライブラリの強制再読み込みの状態（backend/library-reload.md 6.3）。
export type TLibraryReloadState = 'idle' | 'running' | 'done' | 'timeout' | 'error';
export type TLibraryReloadReason =
  | 'busy'
  | 'delete_failed'
  | 'switch_failed'
  | 'not_rebuilt'
  | 'library_changed'
  | 'timeout';

export interface TLibraryReload {
  state: TLibraryReloadState;
  // running: 開始からの経過 / done 等: 所要時間。サーバーで計算した値
  elapsedMs: number;
  timeoutMs: number;
  reason: TLibraryReloadReason | null;
}
