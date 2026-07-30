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

    // ext はプラグイン API の condition には渡さず、JS 側でフィルタする（getItems）。
    // 検証済みなのは単一値の挙動のみで、複数値指定は未検証のため
    // （keyword が黙って無視された前例があり、未検証の値はプラグイン API に渡さない）

    // keyword は condition に渡さず JS 側で照合する（getItems の matchesKeyword）。
    // eagle.item.get() の keywords はファイル名しか見ず、annotation（メモ）を対象にできない。
    // annotation パラメータと併用しても AND になるため「名前 OR メモ」を API 側で表現できない
    // （実機検証: keywords=['screenshot'] × annotation='krea' が 0 件。knowledge.md に詳細）

    if (params.tags) {
      const tags = params.tags.split(',').map((s) => s.trim()).filter(Boolean);
      if (tags.length > 0) condition.tags = tags;
    }

    // folders=uncategorized は「未分類」の仮想指定。プラグイン API に該当概念が無いため
    // condition には渡さず、全件取得後に JS 側で folders 空のアイテムだけ絞り込む（getItems）
    if (params.folders && params.folders !== 'uncategorized') {
      const folders = params.folders.split(',').map((s) => s.trim()).filter(Boolean);
      if (folders.length > 0) condition.folders = folders;
    }

    return condition;
  }

  /**
   * キーワードがアイテムに一致するかを判定する。
   * Eagle 本体の検索窓と同じ挙動に合わせている（実機で確認）:
   *   - 対象はファイル名（name）とメモ（annotation）
   *   - 空白区切りの複数語は AND（順不同）
   *   - 大文字・小文字は区別しない
   *   - 語は単語境界ではなく連続部分文字列として一致する（「foo bar」が「foobar」に一致）
   *   - カンマは区切りではない（「hoge,fuga」は 1 語扱いで一致しない）
   * @param {object} item アイテム
   * @param {string[]} words 小文字化済みの検索語
   */
  function matchesKeyword(item, words) {
    // 改行で連結するので、語がファイル名とメモをまたいで一致することはない。
    const haystack = `${item.name || ''}\n${item.annotation || ''}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  }

  return {
    mapItem,

    /**
     * 画像一覧を取得する。
     * プラグイン API に orderBy / limit / offset が無いため、
     * 並べ替えとページングは取得後に JS 側で行う。
     *
     * @param {object} params { limit, offset, keyword, ext, tags, stars, folders }
     *   offset は「ページ番号」であり、アイテム数ではない（Simple Eagle と同じ仕様）
     *   ext / stars はカンマ区切りの複数値可。folders=uncategorized は未分類を表す
     * @returns {Promise<{data: object[], totalCount: number}>}
     *   data は TImageItem 互換の配列、totalCount は**ページング前**の該当総数。
     *   totalCount は自動更新の変更検知に使う（フロントは先頭1件＋総数で
     *   シグネチャを作る。総数が無いと削除を検知できない。grid.md 6.1）。
     *   どうせ全件フィルタしてから slice しているので追加コストは無い
     */
    async getItems(params) {
      const condition = buildCondition(params);
      let items = await eagle.item.get(condition);

      // folders=uncategorized: どのフォルダにも属さないアイテムだけ残す
      // （プラグイン API に「未分類」の概念が無いため JS 側で絞り込む）
      if (params.folders === 'uncategorized') {
        items = items.filter((item) => (item.folders || []).length === 0);
      }

      // keyword フィルタ（ファイル名 + メモ / 空白区切り AND）。
      // \s は全角スペースにも一致するため、日本語入力の区切りもそのまま扱える
      if (params.keyword) {
        const words = params.keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          items = items.filter((item) => matchesKeyword(item, words));
        }
      }

      // ext フィルタ（カンマ区切りの複数値対応）。
      // eagle.item.get() には渡さず JS 側で絞り込む（複数値が未検証のため）
      if (params.ext) {
        const exts = params.ext.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (exts.length > 0) {
          items = items.filter((item) => exts.includes((item.ext || '').toLowerCase()));
        }
      }

      // stars フィルタ（カンマ区切りの整数 0〜5）。star 未設定は 0 として扱う
      if (params.stars) {
        const stars = params.stars.split(',').map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n));
        if (stars.length > 0) {
          items = items.filter((item) => stars.includes(toInt(item.star)));
        }
      }

      // 追加日時の降順。プラグイン API のデフォルトも同じ順序だが、
      // 保証された仕様ではないため明示的にソートする
      items.sort((a, b) => toInt(b.importedAt) - toInt(a.importedAt));

      const limit = params.limit;
      const start = params.offset * limit;
      return {
        data: items.slice(start, start + limit).map(mapItem),
        totalCount: items.length,
      };
    },

    /**
     * フォルダ一覧をツリー構造で取得する。
     * imageCount はプラグイン API に無いため、全アイテムの folders を集計して数える。
     * あわせて拡張子リスト・未分類件数・全件数も同じ走査で集計する。
     * @returns {Promise<{data: object[], extList: string[], uncategorizedCount: number, totalCount: number}>}
     */
    async getFolders() {
      const [folders, items] = await Promise.all([
        eagle.folder.getAll(),
        eagle.item.get({}),
      ]);

      // フォルダIDごとの直下アイテム数・拡張子リスト・未分類件数を1回の走査で集計する。
      // フォルダごとに get({folders:[id]}) を呼ぶとフォルダ数だけ全件走査が走るため避ける
      const counts = new Map();
      const extSet = new Set();
      let uncategorizedCount = 0;
      for (const item of items) {
        const itemFolders = item.folders || [];
        for (const folderId of itemFolders) {
          counts.set(folderId, (counts.get(folderId) || 0) + 1);
        }
        // どのフォルダにも属さないアイテム = 未分類
        if (itemFolders.length === 0) uncategorizedCount += 1;
        // 拡張子の重複なしリスト（フィルタ UI の候補に使う）
        if (item.ext) extSet.add(String(item.ext).toLowerCase());
      }

      return {
        data: folders.map((folder) => mapFolder(folder, counts)),
        // ライブラリ内の拡張子の重複なしリスト（小文字・昇順）
        extList: Array.from(extSet).sort(),
        uncategorizedCount,
        // 全アイテム数。複数フォルダ所属アイテムの二重計上を避けるため件数の合算ではなく実数を使う
        totalCount: items.length,
      };
    },

    /**
     * アイテムを取得する。存在しなければ throw する（呼び出し側で 404 になる）。
     * @param {string} id
     */
    async getItemById(id) {
      if (!id) throw ME.server.badRequest('id が指定されていません');
      const item = await eagle.item.getById(id);
      if (!item) throw new Error(`アイテムが見つかりません: ${id}`);
      return item;
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

    /**
     * アイテムを指定フォルダへ移動する（追加ではなく置換）。
     * 複数フォルダに属するアイテムは全所属が移動先1つに置き換わる。
     * @param {string[]} itemIds
     * @param {string} folderId 実フォルダ ID、または特殊値 'uncategorized'（未分類へ）
     */
    async moveToFolder(itemIds, folderId) {
      // 実フォルダ ID の場合は実在を先に確認する。
      // 不正な ID で save() するとアイテムがどのフォルダにも表示されなくなるため。
      // uncategorized は「未分類へ移動」の仮想指定なので確認しない
      if (folderId !== 'uncategorized') {
        const folder = await eagle.folder.getById(folderId);
        if (!folder) throw ME.server.notFound(`フォルダが見つかりません: ${folderId}`);
      }

      // uncategorized は全フォルダから外す（空配列）。実 ID は 1 つに置き換える
      const newFolders = folderId === 'uncategorized' ? [] : [folderId];

      // 順次処理のため、途中で失敗すると一部だけ移動済みになり得る（move_to_trash と同じ割り切り）
      for (const id of itemIds) {
        const item = await eagle.item.getById(id);
        if (!item) throw new Error(`アイテムが見つかりません: ${id}`);
        // 各 item に別の配列インスタンスを渡す（参照の共有を避ける）
        item.folders = newFolders.slice();
        await item.save();
      }
    },
  };
})();
