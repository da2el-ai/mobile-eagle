import type { TImageItem, TFolderItem, TFilter } from '../types'
import type { TStoreState } from './index'

export const actions = {
  // 画像一覧を設定
  setImages(this: TStoreState, images: TImageItem[]) {
    this.images = images;
  },

  // 画像一覧に追加（無限スクロール用）
  addImages(this: TStoreState, images: TImageItem[]) {
    this.images.push(...images);
  },
  
  // フォルダ一覧を設定
  setFolders(this: TStoreState, folders: TFolderItem[]) {
    this.folders = folders;
  },
  
  // 現在の画像を設定
  setCurrentImage(this: TStoreState, imageId: string) {
    const image = this.images.find((img: TImageItem) => img.id === imageId);
    this.currentImage = image || null;
  },

  // ページカウントを追加
  addCurrentPageCount(this: TStoreState) {
    this.currentPageCount += 1;
  },

  // 現在のフィルタクエリを設定
  setCurrentFilter(this: TStoreState, filter: TFilter | null) {
    this.currentFilter = filter;
  },

  // 現在のフォルダIDを設定
  setCurrentFolderId(this: TStoreState, folderId: string) {
    this.currentFolderId = folderId;
  },
  
  // 展開フォルダを追加
  addExpandedFolder(this: TStoreState, folderId: string) {
    if (!this.expandedFolders.includes(folderId)) {
      this.expandedFolders.push(folderId);
    }
  },
  
  // 展開フォルダを削除
  removeExpandedFolder(this: TStoreState, folderId: string) {
    const index = this.expandedFolders.indexOf(folderId);
    if (index > -1) {
      this.expandedFolders.splice(index, 1);
    }
  },

  // 拡張子リストを追加
  setExtList(this: TStoreState, extList: string[]) {
    this.extList = extList;
  },

  // 複数選択モードを設定
  setSelectMode(this: TStoreState, isSelect: boolean) {
    this.isSelectMode = isSelect;
  },
  // 複数選択モードを設定
  toggleSelectMode(this: TStoreState) {
    this.isSelectMode = !this.isSelectMode;
    // 選択モードを切り替える時に全ての選択状態をリセット
    this.images.forEach(image => {
      image.select = false;
    });
  },

  // 画像の選択状態を切り替え
  toggleImageSelect(this: TStoreState, imageId: string) {
    const image = this.images.find(img => img.id === imageId);
    if (image) {
      image.select = !image.select;
    }
  },

  // 設定画面の開閉状態を設定
  setSettingOpen(this: TStoreState, isOpen: boolean) {
    this.isSettingOpen = isOpen;
  },

  // フィルター画面の開閉状態を設定
  setFilterOpen(this: TStoreState, isOpen: boolean) {
    this.isFilterOpen = isOpen;
  },

  // フォルダーリストの開閉状態を設定
  setFolderListOpen(this: TStoreState, isOpen: boolean) {
    this.isFolderListOpen = isOpen;
  },
}
