import { reactive, readonly } from 'vue';

// フロントエンド設定の永続化（settings.md 4 章）。
// モジュールスコープに単一の state を持つシングルトン（インスタンス多重生成を防ぐ）。

export type Theme = 'light' | 'dark' | 'auto';
export type ObjectFit = 'cover' | 'contain';

export interface Settings {
  theme: Theme;
  // 自動更新の有効/無効。
  autoReload: boolean;
  // 自動更新間隔（秒）。2〜120 に clamp。
  autoReloadInterval: number;
  // 画像圧縮の閾値（KB）。null = 既定(768) / 0 = 圧縮しない。
  maxFileSize: number | null;
  // JPEG 圧縮率（1〜100）。null = 既定(85)。
  quality: number | null;
  // グリッド列数（グリッドコントローラーが変更）。
  gridCols: number;
  // サムネイルの表示方法（グリッドコントローラーが変更）。
  objectFit: ObjectFit;
}

const STORAGE_KEY = 'mobile-eagle-viewer-settings';

const DEFAULTS: Settings = {
  theme: 'light',
  autoReload: true,
  autoReloadInterval: 10,
  maxFileSize: null,
  quality: null,
  gridCols: 4,
  objectFit: 'cover',
};

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

// 数値へ変換し、数値でなければ fallback を返す。
const toInt = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

// 読み込んだ値を検証し、未知・不正な値は既定値へ寄せる。
const sanitize = (raw: unknown): Settings => {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    theme: r.theme === 'dark' || r.theme === 'auto' ? r.theme : 'light',
    autoReload: typeof r.autoReload === 'boolean' ? r.autoReload : DEFAULTS.autoReload,
    autoReloadInterval: clamp(toInt(r.autoReloadInterval, DEFAULTS.autoReloadInterval), 2, 120),
    maxFileSize: r.maxFileSize == null ? null : Math.max(0, toInt(r.maxFileSize, 0)),
    quality: r.quality == null ? null : clamp(toInt(r.quality, 85), 1, 100),
    gridCols: Math.max(1, toInt(r.gridCols, DEFAULTS.gridCols)),
    objectFit: r.objectFit === 'contain' ? 'contain' : 'cover',
  };
};

const load = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    // localStorage 不可・JSON 破損はいずれも既定値で動作する。
    return { ...DEFAULTS };
  }
};

const state = reactive<Settings>(load());

const save = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // プライベートモード等で保存できない場合はサイレントに失敗する（settings.md 5 章）。
  }
};

// 部分更新。検証・clamp をかけて反映し、即座に保存する。
const update = (patch: Partial<Settings>): void => {
  Object.assign(state, sanitize({ ...state, ...patch }));
  save();
};

// get_image に渡す実効値（null のときは表示既定を明示的に使う。settings.md 4 章）。
const effectiveMaxFileSize = (): number => (state.maxFileSize == null ? 768 : state.maxFileSize);
const effectiveQuality = (): number => (state.quality == null ? 85 : state.quality);

export function useSettings() {
  return {
    settings: readonly(state),
    update,
    effectiveMaxFileSize,
    effectiveQuality,
  };
}
