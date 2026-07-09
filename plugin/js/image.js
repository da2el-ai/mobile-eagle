/**
 * 画像の読み込み・リサイズ・JPEG 圧縮・キャッシュ。
 *
 * 移植元は Simple Eagle の modules/util.py（load_image）。
 * Pillow の代わりに OffscreenCanvas を使う（ネイティブ依存を避けるため。通常の
 * canvas より速く出力も同一であることを検証済み）。
 */

window.ME = window.ME || {};

ME.image = (() => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const crypto = require('crypto');

  /** キャッシュディレクトリ。プラグインフォルダを汚さないよう OS の一時領域に置く */
  const CACHE_DIR = path.join(os.tmpdir(), 'mobile-eagle-cache');

  /** キャッシュの有効期限（1時間） */
  const CACHE_EXPIRY_MS = 60 * 60 * 1000;

  /** これを超えるファイルは処理を拒否する（50MB） */
  const MAX_FILE_BYTES = 50 * 1024 * 1024;

  /** 期限切れキャッシュの掃除をこの確率で行う（Simple Eagle と同じ 1%） */
  const CLEANUP_PROBABILITY = 0.01;

  /** 拡張子 → Content-Type */
  const CONTENT_TYPES = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
  };

  /**
   * ファイルパスから Content-Type を判定する。
   * 判定できない場合はブラウザに解釈を委ねずバイナリとして返す（Simple Eagle と同じ）。
   */
  function contentTypeOf(filePath) {
    return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  }

  /**
   * 元ファイルのサイズに応じた最大解像度を返す。
   * 大きいファイルほど強くリサイズする（Simple Eagle の閾値をそのまま移植）。
   * @param {number} fileSizeKb
   */
  function maxDimensionFor(fileSizeKb) {
    if (fileSizeKb > 10000) return 2048; // 10MB 超 → 2K
    if (fileSizeKb > 5000) return 3072;  // 5MB 超 → 3K
    return 4096;                          // それ以下 → 4K
  }

  /**
   * キャッシュキーを作る。
   * mtime を含めるため元画像が更新されれば自動的にキャッシュミスになる。
   * filePath を含めるためライブラリをまたいだ衝突も起きない。
   */
  function cacheKey(filePath, mtimeMs, maxFileSize, quality) {
    const source = `${filePath}_${mtimeMs}_${maxFileSize}_${quality}`;
    return crypto.createHash('md5').update(source).digest('hex');
  }

  function cachePath(key) {
    return path.join(CACHE_DIR, `${key}.jpg`);
  }

  /** キャッシュが存在し、有効期限内かどうか */
  function readCache(key) {
    const file = cachePath(key);
    try {
      const stat = fs.statSync(file);
      if (Date.now() - stat.mtimeMs > CACHE_EXPIRY_MS) return null;
      return fs.readFileSync(file);
    } catch (err) {
      return null;
    }
  }

  function writeCache(key, buffer) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath(key), buffer);
    } catch (err) {
      // キャッシュは無くても動くので、失敗しても処理は続ける
      ME.logger.error('キャッシュの保存に失敗しました', err);
    }
  }

  /** 期限切れのキャッシュファイルを削除する */
  function cleanupExpired() {
    try {
      if (!fs.existsSync(CACHE_DIR)) return;
      const now = Date.now();
      let deleted = 0;
      for (const name of fs.readdirSync(CACHE_DIR)) {
        const file = path.join(CACHE_DIR, name);
        try {
          if (now - fs.statSync(file).mtimeMs > CACHE_EXPIRY_MS) {
            fs.unlinkSync(file);
            deleted += 1;
          }
        } catch (err) {
          // 読めない・消せないファイルは飛ばす
        }
      }
      if (deleted > 0) ME.logger.log(`期限切れキャッシュを ${deleted} 件削除しました`);
    } catch (err) {
      ME.logger.error('キャッシュの掃除に失敗しました', err);
    }
  }

  /**
   * 画像をリサイズして JPEG に変換する。
   * fetch() は file:// を扱えないため、必ず fs で読んでから Blob 化する。
   * @param {Buffer} buffer 元画像のバイナリ
   * @param {number} maxDimension 長辺の上限
   * @param {number} quality JPEG 品質（0〜1）
   * @returns {Promise<Buffer>}
   */
  async function compress(buffer, maxDimension, quality) {
    const bitmap = await createImageBitmap(new Blob([buffer]));

    // 長辺を maxDimension に収める。元が小さい場合は拡大しない
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // JPEG は透過を持てない。塗らずに描くと透過部分が黒くなるため、先に白で塗る
    // （Simple Eagle が Pillow で行っていた白背景合成の再現）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    return Buffer.from(await blob.arrayBuffer());
  }

  return {
    /**
     * 画像をそのまま読み込む（サムネイル用）。
     * @param {string} filePath
     * @returns {{ buffer: Buffer, contentType: string }}
     */
    loadRaw(filePath) {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_BYTES) {
        throw new Error(`画像が大きすぎます: ${Math.round(stat.size / 1024)}KB (最大 50MB)`);
      }
      return { buffer: fs.readFileSync(filePath), contentType: contentTypeOf(filePath) };
    },

    /**
     * 画像を読み込み、必要なら JPEG 圧縮して返す。
     * @param {string} filePath
     * @param {number} maxFileSizeKb この KB を超えたら圧縮する。0 なら圧縮しない
     * @param {number} quality JPEG 品質（1〜100）
     * @returns {Promise<{ buffer: Buffer, contentType: string }>}
     */
    async load(filePath, maxFileSizeKb, quality) {
      // たまに期限切れキャッシュを掃除する
      if (Math.random() < CLEANUP_PROBABILITY) cleanupExpired();

      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_BYTES) {
        throw new Error(`画像が大きすぎます: ${Math.round(stat.size / 1024)}KB (最大 50MB)`);
      }

      const fileSizeKb = stat.size / 1024;
      const shouldCompress = maxFileSizeKb > 0 && fileSizeKb > maxFileSizeKb;

      if (!shouldCompress) {
        return { buffer: fs.readFileSync(filePath), contentType: contentTypeOf(filePath) };
      }

      const key = cacheKey(filePath, stat.mtimeMs, maxFileSizeKb, quality);
      const cached = readCache(key);
      if (cached) {
        return { buffer: cached, contentType: 'image/jpeg' };
      }

      const original = fs.readFileSync(filePath);
      try {
        const compressed = await compress(original, maxDimensionFor(fileSizeKb), quality / 100);
        // 圧縮成功時のみキャッシュする。中身は常に JPEG なので Content-Type の保存は不要
        writeCache(key, compressed);
        return { buffer: compressed, contentType: 'image/jpeg' };
      } catch (err) {
        // 壊れた画像やデコードできない形式。元ファイルをそのまま返す。
        // フォールバック結果はキャッシュしない（元ファイルを読むだけなので速くならず、
        // ディスクの重複になるだけ）
        ME.logger.error(`圧縮に失敗したため元画像を返します: ${path.basename(filePath)}`, err);
        return { buffer: original, contentType: contentTypeOf(filePath) };
      }
    },

    /**
     * キャッシュを全削除する。ライブラリ切り替え時に呼ばれる。
     * キーは filePath を含むので衝突はしないが、旧ライブラリのキャッシュは
     * 再利用されずディスクの無駄になるため消す。
     */
    clearCache() {
      try {
        if (!fs.existsSync(CACHE_DIR)) return;
        const files = fs.readdirSync(CACHE_DIR);
        for (const name of files) {
          try {
            fs.unlinkSync(path.join(CACHE_DIR, name));
          } catch (err) {
            // 消せないファイルは飛ばす
          }
        }
        ME.logger.log(`キャッシュを ${files.length} 件削除しました`);
      } catch (err) {
        ME.logger.error('キャッシュの削除に失敗しました', err);
      }
    },
  };
})();
