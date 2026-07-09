/**
 * eagle.* API のラッパー。
 *
 * プラグイン API のオブジェクトを、フロントエンド（Simple Eagle から流用）が期待する
 * Web API 互換の形に変換する。両者はプロパティ名が違うため、ここで吸収する。
 */

window.ME = window.ME || {};

ME.eagleAdapter = (() => {
  /**
   * 数値に正規化する。
   * item.star は評価なしのとき undefined が返る（0 ではない）ため、必ず通す。
   */
  function toInt(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
  }

  /**
   * item をフロントの TImageItem 互換に変換する。
   *
   * annotation を undefined のまま返すと、フロントが null ガードなしで
   * annotation.toLowerCase() を呼ぶ箇所（ImageListView.vue）でクラッシュするため、
   * 欠損値は必ず空文字・空配列で埋める。
   * @param {object} item
   */
  function mapItem(item) {
    return {
      id: item.id,
      name: item.name || '',
      size: toInt(item.size),
      ext: item.ext || '',
      tags: item.tags || [],
      folders: item.folders || [],
      annotation: item.annotation || '',
      url: item.url || '',
      width: toInt(item.width),
      height: toInt(item.height),
      star: toInt(item.star),
      // プラグイン API の日時は importedAt / modifiedAt の2つだけ。
      // フロントの型にある modificationTime / lastModified は Web API 由来の名前なので
      // どちらにも modifiedAt を入れる
      modificationTime: toInt(item.modifiedAt),
      lastModified: toInt(item.modifiedAt),
    };
  }

  /**
   * フォルダをフロントの TFolderItem 互換に変換する（子フォルダも再帰的に）。
   * @param {object} folder
   * @param {Map<string, number>} counts フォルダIDごとの直下アイテム数
   */
  function mapFolder(folder, counts) {
    return {
      id: folder.id,
      name: folder.name || '',
      description: folder.description || '',
      children: (folder.children || []).map((child) => mapFolder(child, counts)),
      // フォルダには更新日時が無いため作成日時を入れる
      modificationTime: toInt(folder.createdAt),
      tags: [],
      // imageCount はプラグイン API に存在しないため、アイテム側から集計した値を使う。
      // これは「そのフォルダ直下の件数」であり、子孫は含まない。
      // 子孫の合算はフロントの calculateTotalImageCount() が行うため、
      // ここで子孫を含めると二重計上になる（Web API の folder/list と同じ意味に揃えている）
      imageCount: counts.get(folder.id) || 0,
      descendantImageCount: 0,
      pinyin: '',
      extendTags: [],
    };
  }

  /**
   * eagle.item.get() に渡す検索条件を組み立てる。
   * 空の条件はキーごと渡さない（undefined を渡すと挙動が不定になるため）。
   * @param {object} params パース済みのクエリパラメータ
   */
  function buildCondition(params) {
    const condition = {};

    if (params.ext) condition.ext = params.ext;

    // keyword（単数）はプラグイン API では無視されるため keywords（配列）に変換する
    if (params.keyword) condition.keywords = [params.keyword];

    if (params.tags) {
      const tags = params.tags.split(',').map((s) => s.trim()).filter(Boolean);
      if (tags.length > 0) condition.tags = tags;
    }

    if (params.folders) {
      const folders = params.folders.split(',').map((s) => s.trim()).filter(Boolean);
      if (folders.length > 0) condition.folders = folders;
    }

    return condition;
  }

  return {
    mapItem,

    /**
     * 画像一覧を取得する。
     * プラグイン API に orderBy / limit / offset が無いため、
     * 並べ替えとページングは取得後に JS 側で行う。
     *
     * @param {object} params { limit, offset, keyword, ext, tags, folders }
     *   offset は「ページ番号」であり、アイテム数ではない（Simple Eagle と同じ仕様）
     * @returns {Promise<object[]>} TImageItem 互換の配列
     */
    async getItems(params) {
      const condition = buildCondition(params);
      const items = await eagle.item.get(condition);

      // 追加日時の降順。プラグイン API のデフォルトも同じ順序だが、
      // 保証された仕様ではないため明示的にソートする
      items.sort((a, b) => toInt(b.importedAt) - toInt(a.importedAt));

      const limit = params.limit;
      const start = params.offset * limit;
      return items.slice(start, start + limit).map(mapItem);
    },

    /**
     * フォルダ一覧をツリー構造で取得する。
     * imageCount はプラグイン API に無いため、全アイテムの folders を集計して数える。
     * @returns {Promise<object[]>} TFolderItem 互換の配列
     */
    async getFolders() {
      const [folders, items] = await Promise.all([
        eagle.folder.getAll(),
        eagle.item.get({}),
      ]);

      // フォルダIDごとの直下アイテム数を1回の走査で数える。
      // フォルダごとに get({folders:[id]}) を呼ぶとフォルダ数だけ全件走査が走るため避ける
      const counts = new Map();
      for (const item of items) {
        for (const folderId of item.folders || []) {
          counts.set(folderId, (counts.get(folderId) || 0) + 1);
        }
      }

      return folders.map((folder) => mapFolder(folder, counts));
    },

    /**
     * アイテムを更新する。送られてきたプロパティだけを書き換える。
     * @param {string} id
     * @param {object} data { tags?, annotation?, url?, star? }
     */
    async updateItem(id, data) {
      const item = await eagle.item.getById(id);
      if (!item) throw new Error(`アイテムが見つかりません: ${id}`);

      if (data.tags !== undefined) item.tags = data.tags;
      if (data.annotation !== undefined) item.annotation = data.annotation;
      if (data.url !== undefined) item.url = data.url;
      if (data.star !== undefined) item.star = toInt(data.star);

      await item.save();
    },

    /**
     * アイテムをゴミ箱へ移動する。
     * @param {string[]} itemIds
     */
    async moveToTrash(itemIds) {
      for (const id of itemIds) {
        const item = await eagle.item.getById(id);
        if (!item) throw new Error(`アイテムが見つかりません: ${id}`);
        await item.moveToTrash();
      }
    },
  };
})();
