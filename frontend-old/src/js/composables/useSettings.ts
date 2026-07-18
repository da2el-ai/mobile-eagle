import { ref } from 'vue'

// 設定データの型定義
export type TSettings = {
  max_file_size: number | null
  quality: number | null
  gridSize: {
    base: number
    md: number
    xl: number
  }
  objectFit: 'cover' | 'contain'
}

// デフォルト設定値
const DEFAULT_SETTINGS = {
  max_file_size: 768,
  quality: 85,
  gridSize: {
    base: 4,
    md: 5,
    xl: 6
  },
  objectFit: 'cover'
} as const

// localStorage のキー
const STORAGE_KEY = 'eagle_viewer_settings'

// シングルトンインスタンス
let instance: ReturnType<typeof createSettings> | null = null;

function createSettings() {
  // 設定データ
  const settings = ref<TSettings>({
    max_file_size: null,
    quality: null,
    gridSize: DEFAULT_SETTINGS.gridSize,
    objectFit: DEFAULT_SETTINGS.objectFit
  })

  // localStorageから設定を読み込む
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY)
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        settings.value = {
          max_file_size: parsed.max_file_size || null,
          quality: parsed.quality || null,
          gridSize: parsed.gridSize || DEFAULT_SETTINGS.gridSize,
          objectFit: parsed.objectFit || DEFAULT_SETTINGS.objectFit
        }
      }
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error)
      // エラーの場合はデフォルト値を設定
      resetToDefaults()
    }
  }

  // 設定を保存
  const saveSettings = () => {
    const settingsToSave = {
      max_file_size: settings.value.max_file_size || DEFAULT_SETTINGS.max_file_size,
      quality: settings.value.quality || DEFAULT_SETTINGS.quality,
      gridSize: settings.value.gridSize,
      objectFit: settings.value.objectFit
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave))
    return settingsToSave
  }

  // デフォルト値にリセット
  const resetToDefaults = () => {
    settings.value = {
      max_file_size: DEFAULT_SETTINGS.max_file_size,
      quality: DEFAULT_SETTINGS.quality,
      gridSize: DEFAULT_SETTINGS.gridSize,
      objectFit: DEFAULT_SETTINGS.objectFit
    }
  }

  // 実際の設定値を取得（nullの場合はデフォルト値を返す）
  const getActualSettings = () => {
    return {
      max_file_size: settings.value.max_file_size ?? DEFAULT_SETTINGS.max_file_size,
      quality: settings.value.quality ?? DEFAULT_SETTINGS.quality
    }
  }

  // ファイルサイズ上限を取得
  const getMaxFileSize = (): number => {
    return settings.value.max_file_size ?? DEFAULT_SETTINGS.max_file_size
  }

  // 圧縮率を取得
  const getQuality = (): number => {
    return settings.value.quality ?? DEFAULT_SETTINGS.quality
  }

  // 圧縮が必要かどうかを判定
  const shouldCompress = (fileSizeKB: number): boolean => {
    const maxSize = getMaxFileSize()
    return maxSize > 0 && fileSizeKB > maxSize
  }

  // 設定をクリア
  const clearSettings = () => {
    localStorage.removeItem(STORAGE_KEY)
    settings.value = {
      max_file_size: null,
      quality: null,
      gridSize: DEFAULT_SETTINGS.gridSize,
      objectFit: DEFAULT_SETTINGS.objectFit
    }
  }

  // 初期化時に設定を読み込み
  const initialize = () => {
    loadSettings()
  }

  // グリッドサイズを取得
  const getGridSize = () => {
    return settings.value.gridSize
  }

  // グリッドサイズを設定
  const setGridSize = (newSize: TSettings['gridSize']) => {
    settings.value.gridSize = newSize
    saveSettings()
  }

  // object-fitを取得
  const getObjectFit = () => {
    return settings.value.objectFit
  }

  // object-fitを設定
  const setObjectFit = (newFit: TSettings['objectFit']) => {
    settings.value.objectFit = newFit
    saveSettings()
  }

  return {
    // リアクティブデータ
    settings,
    
    // 関数
    loadSettings,
    saveSettings,
    resetToDefaults,
    getActualSettings,
    getMaxFileSize,
    getQuality,
    shouldCompress,
    clearSettings,
    initialize,
    getGridSize,
    setGridSize,
    getObjectFit,
    setObjectFit,
    
    // 定数
    DEFAULT_SETTINGS
  }
}

// シングルトンパターンを実装したuseSettings
export function useSettings() {
  if (!instance) {
    instance = createSettings()
    instance.initialize()
  }
  return instance
}
