/**
 * エントリポイント。Eagle のライフサイクルイベントと各モジュールの結線だけを行う。
 */

(() => {
  'use strict';

  /**
   * 起動処理中かどうか。
   * Eagle 起動時にも onPluginRun が自動発火するため（検証済み。公式ドキュメントの
   * 「クリック時に呼ばれる」は不正確）、無条件に show() するとEagle 起動のたびに
   * ウィンドウが勝手に開いてしまう。経過時間でユーザー操作と区別する。
   */
  let isBootstrapping = true;

  /** 起動時の自動 onPluginRun と判定する猶予時間（ミリ秒） */
  const BOOTSTRAP_GRACE_MS = 3000;

  /**
   * onLibraryChanged は Eagle 起動直後にも発火する（検証済み）。
   * 初期化と二重処理にならないよう、初回の発火は無視する。
   */
  let isFirstLibraryEvent = true;

  eagle.onPluginCreate(async () => {
    ME.logger.log('プラグインを開始しました');

    setTimeout(() => {
      isBootstrapping = false;
    }, BOOTSTRAP_GRACE_MS);

    // API のルートを登録してからサーバーを起動する。
    // auth は前段フックを差し込むため api の後に登録する（保護対象 /api/eagle/* を守る）
    ME.apiEagle.register();
    ME.version.register();
    ME.auth.register();

    // 前回の設定を復元し、サーバーONなら自動起動する
    const settings = ME.settings.getAll();
    if (settings.serverEnabled) {
      try {
        await ME.server.start(settings.port);
      } catch (err) {
        // エラー表示は server.js 側で実施済み。ここでは何もしない
      }
    } else {
      ME.logger.log('サーバーはOFF設定のため起動しません');
    }
  });

  eagle.onPluginRun(() => {
    if (isBootstrapping) {
      // Eagle 起動に伴う自動発火。ウィンドウは開かない
      eagle.window.hide();
      return;
    }
    // ユーザーがプラグインメニューから起動した
    eagle.window.show();
  });

  eagle.onLibraryChanged((libraryPath) => {
    if (isFirstLibraryEvent) {
      // 起動直後の発火は「切り替え」ではなく初期ライブラリの通知
      isFirstLibraryEvent = false;
      ME.logger.log(`ライブラリ: ${libraryPath}`);
      return;
    }
    ME.logger.log(`ライブラリを切り替えました: ${libraryPath}`);
    // 圧縮画像キャッシュの全削除は Step 8（image.js）で実装する
    if (ME.image) {
      ME.image.clearCache();
    }
  });

  // ステータスウィンドウの UI は status-window.js（ME.statusWindow）が担う。
  // 初期化は status-window.js 側の DOMContentLoaded で行う（backend/status-window.md 5 章）。
})();
