// Eagle API から受け取るフォルダーデータ
export type TFolderItem = {
  id: string
  name: string
  description: string
  children: TFolderItem[]
  modificationTime: number
  tags: string[]
  imageCount: number
  descendantImageCount: number
  pinyin: string
  extendTags: string[]
}

// Eagle API から受け取るアイテムデータ
export type TImageItem = {
  id: string
  name: string
  size: number
  ext: string
  tags: string[]
  folders: string[]
  annotation: string
  width: number
  height: number
  modificationTime: number
  lastModified: number
  star?: number
  select?: boolean
}

// export type TQueryParam = {
//   stars?: number[],
//   offset?: number;
//   orderBy?: string;
//   keyword?: string;
//   ext?: string[];
//   tags?: string;
// }

export type TFilter = {
  stars?: number[],
  exts?: string[];
  keyword?: string;
  tags?: string[];
}
