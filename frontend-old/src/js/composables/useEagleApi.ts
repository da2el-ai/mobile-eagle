import { ref } from 'vue'
import { API_BASE_URL, ITEM_GET_COUNT } from '../env'
import type { TFolderItem, TImageItem } from '../types'
import { useMainStore } from '../store'

class EagleApi {
  private static instance: EagleApi;
  public isImagesLoading = ref(false);
  public isFoldersLoading = ref(false);
  private error = ref<string | null>(null);
  private store = useMainStore();

  private constructor() {}

  public static getInstance(): EagleApi {
    if (!EagleApi.instance) {
      EagleApi.instance = new EagleApi()
    }
    return EagleApi.instance
  }
  
  public isLoading() {
    return this.isImagesLoading
  }

  public getError() {
    return this.error
  }

  /**
   * 画像一覧を取得
   */
  public async loadImages(params: {
    folderId?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    keyword?: string;
    ext?: string;
    tags?: string;
  } = {}): Promise<TImageItem[]> {
    const {
      folderId = 'all',
      limit = 200,
      offset = 0,
      orderBy,
      keyword,
      ext,
      tags
    } = params;
    this.error.value = null
    // console.log('//////[useEagleApi] loadImages', folderId);

    try {
      const url = new URL(`${API_BASE_URL}/list`, window.location.origin)
      url.searchParams.append('limit', limit.toString())
      url.searchParams.append('offset', offset.toString())
      if (folderId && folderId !== 'all') {
        url.searchParams.append('folders', folderId)
      }
      if (orderBy) {
        url.searchParams.append('orderBy', orderBy)
      }
      if (keyword) {
        url.searchParams.append('keyword', keyword)
      }
      if (ext) {
        url.searchParams.append('ext', ext)
      }
      if (tags) {
        url.searchParams.append('tags', tags)
      }
      console.log('API URL:', url.toString());
      const response = await fetch(url)

      // console.log('API response status:', response.status)
      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      // console.log('API response data:', data)
      if (data.status === 'error') {
        console.error('API error:', data.message)
        throw new Error(data.message)
      }

      if (!data.data) {
        console.warn('No data field in response:', data)
        return []
      }
      console.log('Number of images received:', data.data.length)
      return data.data || []

    } catch (err) {
      console.error('Error in loadImages:', err)
      this.error.value = err instanceof Error ? err.message : 'Unknown error occurred'
      return []
    }
  }

  /**
   * 無限スクロール用の画像一覧取得
   */
  public async loadImagesInfinite(params: {
    folderId?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    keyword?: string;
    ext?: string;
    tags?: string;
  } = {}): Promise<void> {

    console.log("ローディング開始");
    this.isImagesLoading.value = true

    const {
      folderId = 'all',
      limit = ITEM_GET_COUNT,
      offset = this.store.getCurrentPageCount,
      orderBy,
      keyword,
      ext,
      tags
    } = params;

    // 初回読み込みの場合は画像をクリア
    if (offset === 0) {
      this.store.setImages([])
      console.log("初回呼び出し");
    } else {
      console.log("2回目以降の呼び出し");
    }

    console.log('//////[useEagleApi] loadImagesInfinite', folderId, limit, offset, orderBy, keyword, ext, tags);

    const images = await this.loadImages({
      folderId,
      limit: ITEM_GET_COUNT,
      offset,
      orderBy,
      keyword,
      ext,
      tags
    })

    // 0件だったらこれ以上のデータは無い
    if (images.length === 0) {
      console.log("データ無かった", this.store.getImages.length);
      this.isImagesLoading.value = false;
      return;
    }

    // 以降はデータがあったときの処理
    this.store.addImages(images)
    this.store.addCurrentPageCount();

    // 取得したデータを加工
    if (this.store.getImages.length > 0) {

      // 拡張子リストを更新
      const extSet = new Set<string>()
      this.store.getImages.forEach((img: TImageItem) => {
        if (img.ext) {
          extSet.add(img.ext.toLowerCase())
        }
      })
      this.store.setExtList(Array.from(extSet))
    }

    console.log("ローディング解除", this.store.getImages.length);
    this.isImagesLoading.value = false;
  }

  /**
   * 子フォルダの imageCount の合計を親フォルダの imageCount に設定する
   */
  calculateTotalImageCount(folders: TFolderItem[]): number {
    let total = 0
    
    for (const folder of folders) {
      // 子フォルダーがある場合、再帰的に処理
      if (folder.children && folder.children.length > 0) {
        // 子フォルダーの imageCount を再帰的に計算
        const childrenTotal = this.calculateTotalImageCount(folder.children)
        // 親フォルダーの imageCount を子フォルダーの合計 + 自身の imageCount に設定
        folder.imageCount = folder.imageCount + childrenTotal
      }
      
      // 全体の合計に追加
      total += folder.imageCount
    }
    
    return total
  }

  /**
   * フォルダー一覧を取得して内部に保存
   */
  public async loadFolders(): Promise<void> {
    // 既に読み込み中の場合は待機
    if (this.isFoldersLoading.value) {
      // 読み込み完了まで待機
      while (this.isFoldersLoading.value) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return
    }

    // 既に読み込み済みの場合はスキップ
    if (this.store.getFolders.length > 0) {
      return
    }

    this.isFoldersLoading.value = true
    this.error.value = null

    try {
      const response = await fetch(`${API_BASE_URL}/folders`)
      // console.log('API response status:', response.status)
      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (data.status === 'error') {
        console.error('API error:', data.message)
        throw new Error(data.message)
      }
      if (!data.data) {
        console.warn('No data field in response:', data)
        this.store.setFolders([])
        return;
      }

      const folders = data.data;

      // 全てのフォルダーのimageCountを合計
      const totalImageCount = this.calculateTotalImageCount(folders);

      // 「全て」アイテムを作成
      const allItem: TFolderItem = {
        id: "all",
        name: "ALL",
        description: "",
        children: [],
        modificationTime: Date.now(),
        tags: [],
        imageCount: totalImageCount,
        descendantImageCount: 0,
        pinyin: "",
        extendTags: []
      }
    
      // 「全て」を先頭に追加して保存
      this.store.setFolders([allItem, ...folders])
 
    } catch (err) {
      console.error('Error in loadFolders:', err)
      this.error.value = err instanceof Error ? err.message : 'Unknown error occurred'
      this.store.setFolders([])
    } finally {
      this.isFoldersLoading.value = false
    }
  }

  /**
   * 画像情報を更新する
   * @param itemId 画像のID
   * @param data 更新データ（tags, annotation, url, star）
   */
  public async updateItem(itemId: string, data: {
    tags?: string[];
    annotation?: string;
    url?: string;
    star?: number;
  }): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: itemId,
          ...data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'error') {
        throw new Error(result.message);
      }

      // 成功した場合、現在のimages配列内の該当アイテムも更新
      const images = this.store.getImages
      const index = images.findIndex(img => img.id === itemId);
      if (index !== -1) {
        const updatedImages = [...images]
        updatedImages[index] = {
          ...updatedImages[index],
          ...data
        };
        this.store.setImages(updatedImages)
      }

      return result;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }

  /**
   * 指定したアイテムをゴミ箱に移動する
   * @param itemIds 削除する画像のIDリスト
   */
  public async moveToTrash(itemIds: string[]): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/move_to_trash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIds: itemIds
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'error') {
        throw new Error(result.message);
      }

      // 成功した場合、現在のimages配列から削除されたアイテムを除去
      const images = this.store.getImages;
      const updatedImages = images.filter(img => !itemIds.includes(img.id));
      this.store.setImages(updatedImages);

      return result;
    } catch (error) {
      console.error('Error moving items to trash:', error);
      throw error;
    }
  }
}

export const useEagleApi = () => {
  return EagleApi.getInstance()
}
