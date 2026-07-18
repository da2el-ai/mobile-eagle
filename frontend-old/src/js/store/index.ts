import { defineStore } from 'pinia'
import type { TImageItem, TFolderItem, TFilter } from '../types'
import { getters } from './getters'
import { actions } from './actions'


// ストアの状態の型定義
export type TStoreState = {
  images: TImageItem[]
  folders: TFolderItem[]
  currentImage: TImageItem | null
  currentFolderId: string | null
  currentFilter: TFilter | null // 現在の検索クエリ
  currentPageCount: number // 取得したページ数
  expandedFolders: string[]
  extList: string[]  // 拡張子リスト
  isSelectMode: boolean // 複数選択モード
  isSettingOpen: boolean // 設定画面の開閉状態
  isFilterOpen: boolean // フィルター画面の開閉状態
  isFolderListOpen: boolean // フォルダーリストの開閉状態
}

export const useMainStore = defineStore('main', {
  state: (): TStoreState => ({
    images: [],
    folders: [],
    currentImage: null,
    currentFolderId: null,
    currentFilter: null,
    currentPageCount: 0,
    expandedFolders: [],
    extList: [],
    isSelectMode: false,
    isSettingOpen: false,
    isFilterOpen: false,
    isFolderListOpen: false,
  }),

  getters,
  actions
})
