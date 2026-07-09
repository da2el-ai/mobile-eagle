# Mobile Eagle テスト用プラグイン仕様書

## 目的

Mobile Eagle 本実装の前に、[概要.md](../概要.md) の「要検証事項」を実機確認するための最小限のテストプラグインを作る。

- このプラグインは検証専用の使い捨てとし、本実装のコードベースにはしない（ただし判明した書き方・ノウハウは流用する）
- 全テスト項目の結果は本仕様書末尾の「検証結果」に記録する

## プラグイン構成

- プラグイン名：`Mobile Eagle Test`
- 種別：バックグラウンドサービス型（`serviceMode: true`）

### ディレクトリ構成

```
plugin-test/
  manifest.json     … プラグイン定義
  index.html        … テスト用ウィンドウUI
  js/
    main.js         … ライフサイクルイベント処理・各テストの実装
  package.json      … npmモジュール検証用（qrcode）
  node_modules/     … （npm install で生成）
```

### manifest.json（案）

```json
{
  "id": "MOBILE_EAGLE_TEST",
  "version": "0.1.0",
  "platform": "all",
  "arch": "all",
  "name": "Mobile Eagle Test",
  "logo": "/logo.png",
  "keywords": [],
  "devTools": true,
  "main": {
    "url": "index.html",
    "serviceMode": true,
    "width": 640,
    "height": 800
  }
}
```

※ `devTools` などの正確なキー名は実装時に公式ドキュメント・サンプル（https://github.com/eagle-app/eagle-plugin-examples ）を確認して調整する。

### テスト用ウィンドウUI

1画面のみ。上から順に：

- ライフサイクルイベントのログ表示エリア（全テスト共通のログ。タイムスタンプ付き・最新が上）
- 各テストの実行ボタンと結果表示（テストごとに1ブロック）
- ログのクリアボタン

## テスト項目

### T1. サービスモードのライフサイクル・二重起動確認

**目的**：serviceMode プラグイン動作中にプラグインパネルでクリックされたとき、二重起動されず既存インスタンスの `onPluginRun` が呼ばれることを確認する（概要.md の設計前提）。

**実装**：

- `onPluginCreate` / `onPluginRun` / `onPluginShow` / `onPluginHide` / `onPluginBeforeExit` の全てをログに記録する
- インスタンス識別のため、`onPluginCreate` 時にメモリ上へランダムな「インスタンスID」と起動時刻を保持し、全ログ行に付記する
- `onPluginRun` で `eagle.window.show()` を実行してウィンドウを表示する

**手順**：

1. Eagle を再起動し、プラグインが自動開始されるか確認（`onPluginCreate` がログに残るか）
2. プラグインパネルからプラグインをクリック → ウィンドウが表示され、ログのインスタンスIDが手順1と同一であることを確認
3. ウィンドウを閉じる（または隠す）→ 再度クリック → インスタンスIDが変わらないことを確認

**判定基準**：

- [x] **Eagle 起動時に自動開始される**（プラグインをクリックせずに `/ping` が応答した）
- [x] クリックで `onPluginRun` が発火し、インスタンスIDが変わらない（＝二重起動されない）
- [x] ウィンドウを閉じてもサービス（メモリ上の状態）が生きている

**取得ログ（抜粋・1回目の検証）**：

```
[16:23:35.243][AK4AXF] DOM構築完了
[16:23:35.353][AK4AXF] onPluginCreate: plugin=Mobile Eagle Test
[16:23:35.358][AK4AXF] T3: サーバー起動 0.0.0.0:8000
[16:23:35.361][AK4AXF] onPluginRun
[16:23:35.398][AK4AXF] onPluginShow: ウィンドウ表示
[16:23:36.338][AK4AXF] onLibraryChanged: /Users/.../AIイラスト2.library
[16:23:41.374][AK4AXF] onPluginHide: ウィンドウ非表示

（ウィンドウを隠して 約20秒後に再クリック）
[16:25:37.921][AK4AXF] onPluginHide: ウィンドウ非表示
[16:25:57.427][AK4AXF] onPluginRun
[16:25:57.450][AK4AXF] onPluginShow: ウィンドウ表示
```

**再検証（Eagle を完全終了 → 起動、プラグインは一切クリックしない）**：

```
[17:05:40.651][3UCGFI] T3: IPアドレスを 4 件検出
[17:05:40.652][3UCGFI] DOM構築完了
[17:05:40.758][3UCGFI] onPluginCreate: plugin=Mobile Eagle Test
[17:05:40.758][3UCGFI] インスタンス生成 id=3UCGFI startedAt=2026-07-09T08:05:40.637Z
[17:05:40.763][3UCGFI] T3: サーバー起動 0.0.0.0:8000
[17:05:40.765][3UCGFI] onPluginRun          ← クリックしていないのに発火
[17:05:40.801][3UCGFI] onPluginShow: ウィンドウ表示
[17:05:41.283][3UCGFI] onLibraryChanged: /Users/.../ネタ画像.library
```

クリックせずに `http://localhost:8000/ping` へアクセスした結果：

```
{"status":"ok","time":"2026-07-09T08:06:19.561Z","instance":"3UCGFI"}
```

**判明したこと**：

- ✅ **`serviceMode: true` による Eagle 起動時の自動開始は成功している**。クリックしていないのにインスタンス `3UCGFI` が生成され、HTTPサーバーが応答している
- ⚠️ **`onPluginRun` は Eagle 起動時にも自動発火する**（`onPluginCreate` の7ms後）。「ユーザーがプラグインパネルでクリックしたとき」だけに発火するという公式ドキュメントの記述は不正確
  - 結果として、`onPluginRun` で無条件に `eagle.window.show()` を呼ぶと **Eagle 起動のたびにウィンドウが勝手に開いてしまう**
- 再クリックしてもインスタンスIDが変わらず `onPluginCreate` も再発火しない → **二重起動されない**ことを確認。設計前提は正しい
- 非表示中もメモリ上の状態（ログ・インスタンスID）とHTTPサーバーが保持される → **サービス継続を確認**
- `onLibraryChanged` は Eagle 起動直後にも1回発火する（初期ライブラリの通知）

**対策**：

`onPluginCreate` からの経過時間で「起動時の自動発火」と「ユーザーのクリック」を区別する。起動直後の一定時間（3秒）内の `onPluginRun` は自動発火とみなし、`eagle.window.show()` を呼ばずに `eagle.window.hide()` する。

```js
let isBootstrapping = true;

eagle.onPluginCreate(() => {
  setTimeout(() => { isBootstrapping = false; }, 3000);
  // …
});

eagle.onPluginRun(() => {
  if (isBootstrapping) {
    eagle.window.hide();  // 起動時の自動発火。ウィンドウは開かない
    return;
  }
  eagle.window.show();    // ユーザーのクリック
});
```

**対策後の再検証（Eagle を完全終了 → 起動）**：

```
[17:15:24.673][GJM3E4] DOM構築完了
[17:15:24.782][GJM3E4] onPluginCreate: plugin=Mobile Eagle Test
[17:15:24.787][GJM3E4] T3: サーバー起動 0.0.0.0:8000
[17:15:24.790][GJM3E4] onPluginRun: 起動時の自動発火とみなしてウィンドウを表示しない（hide を実行）
[17:15:25.201][GJM3E4] onLibraryChanged: /Users/.../ネタ画像.library
[17:15:27.788][GJM3E4] 起動処理の猶予時間(3000ms)が終了。以降の onPluginRun はユーザー操作とみなす

（プラグインメニューから手動で起動）
[17:15:47.275][GJM3E4] onPluginRun: ユーザー操作とみなしてウィンドウを表示する
[17:15:47.302][GJM3E4] onPluginShow: ウィンドウ表示
```

ウィンドウを開かずに `http://localhost:8000/ping` へアクセスした結果：

```
{"status":"ok","time":"2026-07-09T08:16:21.889Z","instance":"GJM3E4"}
```

**対策の効果（すべて確認済み）**：

- ✅ Eagle 起動時にプラグインウィンドウが開かない（**一瞬のちらつきも発生しない**）
- ✅ ウィンドウを開かなくてもサーバーは稼働し `/ping` が応答する
- ✅ プラグインメニューからの手動起動ではウィンドウが正しく開く
- ✅ 起動時と手動起動でインスタンスID `GJM3E4` が不変（二重起動なし）
- ✅ `onPluginShow` は手動起動時のみ発火する（起動時の `hide()` により抑止されている）

3秒の猶予時間は十分に機能した（自動発火は `onPluginCreate` の8ms後、手動クリックは23秒後）。

### T2. ウィンドウ非表示中のダイアログ・通知の挙動

**目的**：バックグラウンド動作中のエラー通知手段として何が使えるかを確定する（概要.md「エラー発生時の通知方法」の要検証部分）。

**実装**：以下の3つのボタンを設置。いずれも「押してから10秒後に実行」とし、その間にユーザーがウィンドウを隠す。

- `alert()` 実行ボタン
- `eagle.dialog.showMessageBox()` 実行ボタン
- `eagle.notification.show()` 実行ボタン

**手順**：各ボタンを押す → 即座にウィンドウを閉じる（隠す）→ 10秒後の挙動を観察する。

**判定基準**（それぞれ記録する）：

- [x] `alert()`：**プラグインウィンドウが再出現し、その上にダイアログが表示される**。表示中も Eagle 本体は操作可能
- [x] `showMessageBox()`：`alert()` と同様（ウィンドウが再出現してダイアログ表示）。Eagle 本体は操作可能
- [x] `notification.show()`：**OSのトースト通知が出て数秒後に自動消滅**。プラグインウィンドウは出現しない。Eagle 本体は操作可能

**判明したこと**：

- `alert()` / `showMessageBox()` は非表示中でも**確実にユーザーに気づいてもらえる**。ただし副作用としてプラグインウィンドウが強制的に再出現する
- どちらも Eagle 本体の操作をブロックしない（アプリモーダルではない）ため、作業中断のデメリットは小さい
- `notification.show()` はウィンドウを出さないので邪魔にならないが、時間経過で消えるため見逃される可能性がある

**結論（本実装の方針）**：

| エラーの重大度 | 通知手段 |
| --- | --- |
| 重大（サーバー起動失敗・ポート使用中など、機能が使えない） | `eagle.window.show()` でウィンドウを表示し画面内にエラー表示 + `eagle.dialog.showMessageBox()` |
| 軽微（個別リクエストの失敗など） | ログ（直近200件）に記録するのみ。必要なら `notification.show()` |

`alert()` ではなく `showMessageBox()` を使う。挙動は同じだがタイトル・詳細文・ボタンを制御でき、非同期で扱えるため。

### T3. HTTPサーバーの起動と外部アクセス

**目的**：プラグイン内で `0.0.0.0` バインドのHTTPサーバーが起動でき、別端末（スマホ・別PC）からLAN/Tailscale経由でアクセスできることを確認する。プロジェクトの根幹となる検証。

**実装**：

- Node.js 標準の `http` モジュールで `0.0.0.0:8000` にサーバーを起動（`onPluginCreate` で自動起動）
- エンドポイント：
  - `GET /ping` … `{"status":"ok","time":"<現在時刻>"}` を返す
  - `GET /` … 簡単なHTML（「Mobile Eagle Test」と表示するだけ）を返す
- ウィンドウに `os.networkInterfaces()` で列挙した全IPv4アドレス（インターフェース名付き）を表示する
- ポート使用中などの起動エラーはログに記録する

**手順**：

1. 同一PCのブラウザから `http://localhost:8000/ping` にアクセス
2. スマホ（同一LAN）から `http://{LANのIP}:8000/ping` にアクセス
3. スマホ（Tailscale経由）から `http://{TailscaleのIP}:8000/ping` にアクセス

**判定基準**：

- [x] localhost でアクセスできる
- [x] LAN経由でアクセスできる（**macOSのファイアウォール許可ダイアログは表示されなかった**）
- [x] Tailscale経由でアクセスできる
- [x] `os.networkInterfaces()` でLAN・TailscaleのIPが列挙できる（4件検出: `192.168.2.143`, `192.168.2.139`, `100.87.252.62`(Tailscale), `192.168.64.1`）

**取得ログ**：

```
同一PC          : {"status":"ok","time":"2026-07-09T07:33:24.965Z","instance":"AK4AXF"}
スマホ(同一LAN) : {"status":"ok","time":"2026-07-09T07:35:05.509Z","instance":"AK4AXF"}
スマホ(Tailscale): {"status":"ok","time":"2026-07-09T07:35:35.964Z","instance":"AK4AXF"}
```

**判明したこと**：

- **本プロジェクトの根幹が成立することを確認**。プラグイン内の Node.js `http` サーバーが `0.0.0.0` で待ち受け、スマホから LAN・Tailscale の両方で到達できる
- ファイアウォール許可ダイアログが出なかったのは、Eagle 本体が既に許可済みのため（プラグインは Eagle のプロセス内で動く）。**ユーザーの追加操作が不要**という点で導入の敷居が下がる
- サーバーの起動・停止がウィンドウから制御でき、停止中はアクセスがエラーになることも確認

### T4. npmモジュール（qrcode）の利用

**目的**：ピュアJSのnpmモジュールが `require()` で使えることと、QRコード生成ができることを確認する。

**実装**：

- `package.json` に `qrcode` を追加し `npm install`
- ボタン押下で、T3のサーバーURL（選択したIP + ポート）をQRコード化して `<img>`（Data URL）で表示する

**判定基準**：

- [x] `require('qrcode')` が動作する
- [x] 生成されたQRコードをスマホで読み取り、T3のページが開ける（「接続に成功しました。」が表示された）

**判明したこと**：

- ピュアJSのnpmモジュールが `require()` でそのまま使える（ネイティブビルド不要のパッケージなら問題なし）
- QRコードによる初回アクセスの導線が成立する

### T5. Canvas APIによる画像リサイズ・JPEG圧縮の性能

**目的**：Pillow の代替として Canvas API が実用的な速度で動くかを確認する（sharp のネイティブビルド問題を回避できるか）。

**実装**：

- ボタン押下で以下を実行：
  1. `eagle.item.get()` でライブラリからファイルサイズの大きい画像を数件取得（例：サイズ降順で5件）
     1. 拡張子は `.webp` に限定する
  2. 各画像の `filePath` から画像を読み込み、Canvas で長辺2048pxにリサイズ → JPEG（品質85）に変換
  3. 1件ごとの処理時間・元サイズ・変換後サイズをログに記録
- 可能なら `OffscreenCanvas` / `createImageBitmap` を使い、通常のCanvasとの速度差も記録する

**判定基準**：

- [x] 変換が正しく動作する（変換後画像をウィンドウ内にサムネイル表示して目視確認）
- [x] 処理時間が実用範囲か（目安：4K級の画像1枚あたり1秒以内）→ **合計 122〜169ms で目安を大幅にクリア**

**実行結果**（対象5件 / 長辺2048px / JPEG品質85）：

| ファイル | 元解像度 | 元サイズ | 読込 | Canvas | Offscreen | 変換後 |
| --- | --- | --- | --- | --- | --- | --- |
| 00065-2023-08-07_LoliyellMix_v4 | 2304x2880 | 5.36 MB | 111ms | 58ms | 40ms | 526.8 KB |
| v4_01_plot | 3744x2084 | 5.06 MB | 118ms | 38ms | 34ms | 476.1 KB |
| 20250309_183406_360827-_SDXL... | 2512x3504 | 4.34 MB | 104ms | 37ms | 27ms | 352.2 KB |
| 20260517-キョンシー_nsfw | 2432x1664 | 4.24 MB | 96ms | 31ms | 28ms | 486.3 KB |
| 20260517-キョンシー_sfw | 2432x1664 | 4.23 MB | 95ms | 46ms | 27ms | 474.8 KB |

**判明したこと**：

- **Pillow の代替として Canvas API で十分**。sharp などのネイティブモジュールを導入する必要はない
- 処理時間の内訳は **読込（デコード）が支配的**（95〜118ms）で、リサイズ＋エンコードは 27〜58ms
- **OffscreenCanvas の方が常に速い**（27〜40ms vs 31〜58ms）。出力サイズは両者で完全に同一 → 本実装では OffscreenCanvas を採用する
- 圧縮率は 4〜5MB → 350〜530KB（約1/10）で、Simple Eagle と同等の効果

### T6. ゴミ箱アイテムの取得・フォルダ移動

**目的**：Simple Eagle で Web API の制約により実現できなかった2機能が、プラグインAPIなら可能かを確認する。

**実装**：以下の2つのボタンを設置。

- **ゴミ箱取得テスト**：`eagle.item.get()` の検索条件や item のプロパティ（`isDeleted` 等）を調査し、ゴミ箱内アイテムが取得できるか試す。結果（取得できた件数 or 不可）をログに記録
- **フォルダ移動テスト**：選択中のアイテム（`eagle.item.getSelected()`）の `folders` プロパティを書き換えて `item.save()` を実行し、Eagle 本体側でフォルダが移動するか確認

**手順**：事前にEagle側で「テスト用フォルダ」と「ゴミ箱に数件のアイテム」を用意しておく。

**判定基準**：

- [ ] **ゴミ箱内アイテムが取得できる → できない**
- [x] **フォルダ移動ができる → できる**（Simple Eagle では不可だった機能が実現できる）

**ゴミ箱の実行結果**：

```
eagle.item.get({}):              全 19059 件 / うち isDeleted=true は 0 件
eagle.item.getAll():             全 19059 件 / うち isDeleted=true は 0 件
eagle.item.get({isDeleted:true}): 19059 件（うち実際に isDeleted=true は 0 件）
eagle.folder.getAll():           18 件
```

Eagle 本体側ではゴミ箱に **661件** 存在するが、上記のいずれの方法でも1件も取得できなかった。

**判明したこと（ゴミ箱）**：

- プラグインAPIは**ゴミ箱内アイテムを一切返さない**。`isDeleted` プロパティは存在するが常に `false`（＝実質的に使い道がない）
- `get({isDeleted:true})` は**パラメータが無視され**、通常の全件（19059件）が返る。検索条件として機能しない
- `folder.getAll()` にもゴミ箱相当のフォルダは現れない
- **Simple Eagle と同じ制約が残る**。Web API の制約ではなく Eagle の仕様と考えられる
- 代替手段としてライブラリフォルダ内の `metadata.json` を直接読む方法は理論上あるが、公式ドキュメントが「`metadata.json` を直接操作せず `item` API の `save()` を使うこと」と明記しているため**採用しない**

**フォルダ移動の実行結果**：

```
krea2_turbo_fp8_scaled_00337_.webp: [] → ["MRD6JSFZUXD6V"]
krea2_turbo_fp8_scaled_00336_.webp: [] → ["MRD6JSFZUXD6V"]
再取得して確認: krea2_turbo_fp8_scaled_00337_ の folders = ["MRD6JSFZUXD6V"]
```

**判明したこと（フォルダ移動）**：

- `item.folders` を書き換えて `await item.save()` するだけで移動でき、Eagle 本体の表示にも反映される
- 複数アイテムの一括移動も動作する
- **Simple Eagle の「フォルダ移動ができない」という不満点は Mobile Eagle で解消できる**

**その他の副次的な発見**：

- `eagle.item.get({})` は **19059件を一度に返す**（ページングなし）。Simple Eagle では600件ずつ取得していたが、プラグインAPIでは全件取得が可能
- ただし全件取得のコストは未計測。本実装では `fields` パラメータで返却フィールドを絞る最適化を検討する

### T7. ライブラリ切り替え時の挙動

**目的**：`onLibraryChanged` の発火と、切り替え後もHTTPサーバー・プラグインAPIが正常に動くことを確認する。

**実装**：

- `onLibraryChanged` をログに記録（新ライブラリのパスも記録）
- 切り替え後に T3 の `/ping` と `eagle.item.get()` が正常動作するか確認するボタンを設置

**判定基準**：

- [x] `onLibraryChanged` が発火し、新しいライブラリパスが取得できる
- [x] 切り替え後もHTTPサーバーが動作している
- [x] 切り替え後も `eagle.item.get()` が新ライブラリのデータを返す

**実行結果**：

```
onLibraryChanged を受信: /Volumes/D/lora/学習素材.library

HTTPサーバー: OK ({"status":"ok","time":"2026-07-09T07:44:53.410Z","instance":"AK4AXF"})
eagle.library.path: /Volumes/D/lora/学習素材.library
eagle.item.get({}): 44065 件
先頭アイテム: 61cGMXNeZWL._AC_SX679 (800×800).jpg
```

**判明したこと**：

- ライブラリ切り替え後も**サーバーはプロセスごと生き続け**、インスタンスID も変わらない（再起動不要）
- `eagle.item.get()` は自動的に新ライブラリのデータを返す。パスの手動追従は不要
- ただし本実装では、**切り替え時にサーバー側のキャッシュ（圧縮画像など）を破棄する必要がある**（旧ライブラリのアイテムIDが衝突する可能性があるため）
- `onLibraryChanged` は Eagle 起動直後にも発火するので、初期化処理と二重にならないよう注意する

### T8. 静的ファイル配信（HTML / CSS / JS）

**目的**：スマホ向けフロントエンドをプラグインに同梱し、HTTPサーバーから配信できることを確認する。
`.eagleplugin` にパッキングした後もプラグインフォルダ内のファイルが読めるか（パス解決ができるか）が要点。

**実装**：

- `plugin-test/public/` に、クリックで数字がカウントアップする最小限のページを置く
  - `index.html` / `css/style.css` / `js/app.js`（グラデーション背景でCSSの適用を目視判別できるようにする）
  - ページ内から同一オリジンの `/ping` を `fetch()` して、API併用ができることも確認する
- HTTPサーバーの `/ping` `/hello` 以外のパスを `public/` 配下の静的ファイルとして配信する
- プラグインルートの解決は3通りを試し、すべてログに記録する
  1. `eagle.plugin.path`
  2. `location.href`（`file://` から導出）
  3. `__dirname` の親ディレクトリ
- `public/` の外に出るパスは403で拒否する（ディレクトリトラバーサル対策）

**手順**：

1. ステータスウィンドウの T8「配信元を確認」を押し、パス解決の結果とファイルの実在（○×）を確認する
2. 「ブラウザで開く」でPC上の表示を確認する
3. スマホから `http://{IP}:{ポート}/` を開き、以下を確認する
   - カウントアップボタンが動く（JavaScript）
   - 背景がグラデーションで表示される（CSS）
   - 「配信元の情報」に `/ping` の応答が表示される（同一オリジンのAPI呼び出し）
4. **プラグインをパッキング（`.eagleplugin`）してインストールし直し、同じことができるか確認する**

**判定基準**：

- [x] プラグインルートのパスが解決できる（3段フォールバックで解決。`.eagleplugin` 展開後も有効）
- [x] HTML / CSS / JS がすべて正しい Content-Type で配信される
- [x] スマホでカウントアップが動作し、CSSが適用されている
- [x] ページ内から `/ping` を呼べる
- [x] **`.eagleplugin` としてインストールした後も同様に動作する**（Tailscale 経由で表示を確認）
- [x] `public/` の外のファイルが配信されない（**Eagle内の実機でも403を確認**）

**判明したこと**：

- **フロントエンドをプラグインに同梱して配布できる**。`.eagleplugin` にパッキングすると `public/` ごとアーカイブされ、インストール後もプラグインフォルダから読み出して配信できる
- パッキング前（ローカルプロジェクトとしてインポート）とパッキング後（`.eagleplugin` をインストール）で挙動は変わらない
- スマホから Tailscale 経由で HTML / CSS / JavaScript がすべて配信され、同一オリジンのAPI（`/ping`）も呼べた
  → **Simple Eagle の Vue 3 SPA（ビルド済み `dist/`）をそのまま同梱する構成が成立する**

**ディレクトリトラバーサル対策の検証（Eagle内の実機・2026-07-09）**：

稼働中のプラグイン（instance `U0EVDO`）に対して `curl --path-as-is` で正規化前のパスを送信した結果。

```
/../manifest.json          → 403   （プラグインの定義ファイル）
/../js/main.js             → 403   （プラグイン本体のコード）
/../package.json           → 403
/../../../../etc/passwd    → 403   （OSのファイル）
/%2e%2e/manifest.json      → 403   （URLエンコードされた ../）

/                          → 200 text/html; charset=utf-8
/css/style.css             → 200 text/css; charset=utf-8
/js/app.js                 → 200 text/javascript; charset=utf-8
```

**注意**：ブラウザから `http://{IP}:{ポート}/../manifest.json` にアクセスしても **403 ではなく 404 になる**。
ブラウザが送信前にURLを正規化して `/manifest.json` に直すため、サーバーに `../` が届かず
「`public/manifest.json` が存在しない」という判定になるだけである（これも安全側の結果）。

403 を観測するには `curl --path-as-is` のように**正規化しないクライアント**を使う必要がある。
LANに公開する以上そうしたアクセスは想定すべきなので、**このガードは本実装にも必ず入れる**。

## 実装上の注意

- インデントは2スペース、コメントは日本語で書く
- フレームワークは使わない（素のHTML/CSS/JS。検証専用のため）
- テストプラグインの配置場所はプロジェクト直下の `plugin-test/` とし、Eagleの開発者モード（プラグインパネルからローカルフォルダをインポート）で読み込む

## 検証結果

実施日：2026-07-09
環境：macOS / Eagle 4.0.0 (build 20260401)

| No. | 項目 | 結果 | 備考 |
| --- | --- | --- | --- |
| T1 | ライフサイクル・二重起動 | ✅ 成功 | 自動開始・二重起動なし・非表示中の継続すべて確認。**`onPluginRun` が起動時にも自動発火する**問題は対策済み・検証済み |
| T2 | 非表示中のダイアログ・通知 | ✅ 確認 | `showMessageBox()` はウィンドウを再出現させて確実に表示。通知は自動消滅 |
| T3 | HTTPサーバー・外部アクセス | ✅ 成功 | localhost / LAN / Tailscale すべて到達。**ファイアウォール許可ダイアログなし** |
| T4 | npmモジュール（qrcode） | ✅ 成功 | `require()` で利用可。QRコードからスマホでアクセスできた |
| T5 | Canvas圧縮性能 | ✅ 成功 | 4〜5MBの画像を 122〜169ms で1/10に圧縮。**OffscreenCanvasが常に高速** |
| T6 | ゴミ箱取得 | ❌ 不可 | ゴミ箱661件に対し取得0件。`isDeleted` は常にfalse、検索条件としても無視される |
| T6 | フォルダ移動 | ✅ 可能 | `item.folders` を書き換えて `save()` で移動できる（Simple Eagleの不満点を解消） |
| T7 | ライブラリ切り替え | ✅ 成功 | サーバー継続、`item.get()` は新ライブラリを自動参照 |
| T8 | 静的ファイル配信 | ✅ 成功 | **`.eagleplugin` 化後も Tailscale 経由で HTML/CSS/JS を配信できた**。フロントエンド同梱で配布可能 |

### 本実装への反映事項

1. **`onPluginRun` は Eagle 起動時にも自動発火する**ため、`eagle.window.show()` を無条件に呼ばない。`onPluginCreate` からの経過時間で「起動時の自動発火」と「ユーザーのクリック」を区別する（詳細はT1）
2. **画像圧縮は `OffscreenCanvas` を採用**（通常Canvasより高速・出力は同一）。sharp / Pillow 相当のネイティブ依存は不要
3. **画像の読み込みは `fs.readFileSync(item.filePath)` → `Blob` → `createImageBitmap()`**（`fetch()` は `file://` を扱えない）
4. **エラー通知は `eagle.dialog.showMessageBox()` を採用**。`alert()` と挙動は同じだがタイトル・詳細文を制御でき非同期で扱える。軽微なエラーはログのみ
5. **ゴミ箱閲覧は Mobile Eagle でも実装しない**（Simple Eagle と同じ制約）。ドキュメントにその旨を明記する
6. **フォルダ移動は実装する**（Simple Eagle からの新機能）
7. **ライブラリ切り替え時はサーバー側キャッシュを破棄する**（`onLibraryChanged` をフックする）
8. `onLibraryChanged` は Eagle 起動直後にも発火するため、初期化処理と二重にならないようガードする
9. `eagle.item.get()` に `orderBy` / `limit` / `offset` は**存在しない**。並べ替え・件数制限はJS側で行う
10. `eagle.item.get({})` は全件（数万件）を一度に返す。**`fields` パラメータで返却フィールドを絞る最適化を検討する**

### 総括

**全8項目の検証を完了。Mobile Eagle は Eagle プラグインとして実現可能であることが確認できた。**

想定していた動作フローが、`.eagleplugin` としてインストールした状態で成立している：

1. Eagle を起動する → プラグインが自動で常駐し、HTTPサーバーが `0.0.0.0:8000` で待ち受ける（ウィンドウは開かない）
2. スマホから LAN / Tailscale 経由でアクセスし、**同梱したフロントエンド（HTML/CSS/JS）が表示される**（ファイアウォールの許可操作も不要）
3. ステータス確認したいときだけプラグインメニューからウィンドウを開く（二重起動しない）

未解決の課題はない。ゴミ箱閲覧のみ Eagle 側の制約により実装不可と確定した。

**本実装で流用できるテストプラグインのコード**：

| 機能 | 参照先 |
| --- | --- |
| 起動時の自動発火とユーザークリックの判別 | `js/main.js` の `isBootstrapping` |
| HTTPサーバーの起動・停止・エラー処理 | `js/main.js` の `startServer()` / `stopServer()` |
| 静的ファイル配信（MIME判定・トラバーサル対策） | `js/main.js` の `serveStatic()` |
| プラグインルートのパス解決（3段フォールバック） | `js/main.js` の `resolvePluginRoot()` |
| IPアドレス列挙とTailscale/LANの判別 | `js/main.js` の `listIpAddresses()` / `detectKind()` |
| 画像のリサイズ・JPEG圧縮 | `js/main.js` の `compressItem()` |
| QRコード生成 | `js/main.js` の `generateQrCode()` |
