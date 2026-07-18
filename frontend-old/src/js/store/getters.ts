import type { TStoreState } from './index'
import type { TImageItem, TFolderItem } from '../types'

export const getters = {
  // 画像一覧を取得
  getImages: (state: TStoreState) => state.images,
  
  // フォルダ一覧を取得
  getFolders: (state: TStoreState) => state.folders,

  // 現在の画像を取得
  getCurrentImage: (state: TStoreState) => state.currentImage,

  // 選択状態の画像を取得
  getSelectedImages: (state: TStoreState) => state.images.filter(image => image.select),

  // 現在のフィルタクエリを取得
  getCurrentFilter: (state: TStoreState) => state.currentFilter,

  // 現在の取得済みページ数
  getCurrentPageCount: (state: TStoreState) => state.currentPageCount,

  // 現在のフォルダIdを取得
  getCurrentFolderId: (state: TStoreState) => state.currentFolderId,

  // 現在のフォルダを取得
  getCurrentFolder: (state: TStoreState) => {
    const findFolder = (folders: TFolderItem[], id: string): TFolderItem | null => {
      for (const folder of folders) {
        if (folder.id === id) return folder;
        if (folder.children) {
          const found = findFolder(folder.children, id);
          if (found) return found;
        }
      }
      return null;
    }    
    return findFolder(state.folders, state.currentFolderId as string);
  },
  
  // 現在の画像のインデックスを取得
  getCurrentImageIndex(state: TStoreState) {
    if (!state.currentImage) return -1
    return state.images.findIndex(img => img.id === state.currentImage!.id)
  },
  
  // 次の画像を取得
  getNextImage(state: TStoreState): TImageItem | null {
    if (!state.currentImage) return null
    const currentIndex = getters.getCurrentImageIndex(state);
    if (currentIndex === -1 || currentIndex === state.images.length - 1) return null
    return state.images[currentIndex + 1]
  },
  
  // 前の画像を取得
  getPrevImage(state: TStoreState): TImageItem | null {
    if (!state.currentImage) return null
    const currentIndex = getters.getCurrentImageIndex(state);
    if (currentIndex === -1 || currentIndex === 0) return null
    return state.images[currentIndex - 1]
  },
  
  // パンくずリストを取得
  getBreadcrumbs: (state: TStoreState) => {
    if (!state.folders) return []
    
    const breadcrumbs: TFolderItem[] = []
    const findPath = (folders: TFolderItem[], targetId: string, path: TFolderItem[]): boolean => {
      for (const folder of folders) {
        const newPath = [...path, folder]
        if (folder.id === targetId && folder.id !== 'all') {
          breadcrumbs.push(...newPath)
          return true
        }
        if (folder.children && findPath(folder.children, targetId, newPath)) {
          return true
        }
      }
      return false
    }
    
    findPath(state.folders, state.currentFolderId as string, [])
    return breadcrumbs
  },

  // 現在のフォルダーの子フォルダーを取得
  getChildFolders: (state: TStoreState) => {
    // if (!props.folderId) {
    //   // ルートレベルの場合、トップレベルフォルダーを返す
    //   return allFolders.value
    // }
    
    // 指定されたフォルダーIDの子フォルダーを検索
    const findChildren = (folders: TFolderItem[], targetId: string): TFolderItem[] => {
      for (const folder of folders) {
        if (folder.id === targetId) {
          return folder.children || []
        }
        if (folder.children && folder.children.length > 0) {
          const result = findChildren(folder.children, targetId)
          if (result.length > 0) {
            return result
          }
        }
      }
      return []
    }
    
    return state.currentFolderId ? findChildren(state.folders, state.currentFolderId) : []
  },

  // 拡張子リストを取得
  getExtList: (state: TStoreState) => state.extList,

  // 設定画面の開閉状態を取得
  getSelectMode: (state: TStoreState) => state.isSelectMode,

  // 設定画面の開閉状態を取得
  getSettingOpen: (state: TStoreState) => state.isSettingOpen,

  // フィルター画面の開閉状態を取得
  getFilterOpen: (state: TStoreState) => state.isFilterOpen,

  // フォルダーリストの開閉状態を取得
  getFolderListOpen: (state: TStoreState) => state.isFolderListOpen,
}
