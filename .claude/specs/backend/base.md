# バックエンド基盤（Simple Eagle 移植） 仕様書

## 1. 概要

Simple Eagle の Python + FastAPI バックエンドを、Mobile Eagle プラグイン内の Node.js に移植する。
HTTP サーバーの起動・停止、6 つの API エンドポイント、フロントエンドの静的配信、圧縮画像キャッシュを含む。

**フロントエンド（Vue 3 SPA）を無改変で流用するため、API のパス・パラメータ・レスポンス形式は
Simple Eagle と互換にする。**

## 2. 背景・目的

- Simple Eagle は Eagle Web API（`localhost:41595`）+ Python で実現していたが、導入の敷居が高い
- プラグイン化により「`.eagleplugin` をインストールするだけ」で使えるようにする
- データアクセスを Web API からプラグイン API（`eagle.item` / `eagle.folder`）へ置き換える

**Simple Eagle からの主な変更点と理由**：

| 変更点 | 理由 |
| --- | --- |
| Python + FastAPI → Node.js（素の JS、フレームワークなし） | プラグインの実行環境が Node.js 16。検証済みの `http` モジュールで足りる |
| Web API → プラグイン API | `localhost:41595` への依存を排除。トークン認証も不要になる |
| サムネイルパスの `_thumbnail.png` 文字列加工を廃止 | プラグイン API の item が `filePath` / `thumbnailPath` を直接持つ |
| Pillow → OffscreenCanvas | ネイティブ依存の排除。性能は検証済み（T5） |
| キャッシュ先を `cache/` → OS の一時ディレクトリ | プラグインフォルダを汚さない。プラグイン更新でも消えない |
| `limit` / `offset` / ソートを JS 側で実装 | プラグイン API の `eagle.item.get()` に該当パラメータが存在しない |
| 圧縮失敗フォールバックの結果は**キャッシュしない** | フォールバックは元ファイルを読むだけなのでキャッシュしても速くならず、ディスクの重複になるだけ。これによりキャッシュは JPEG のみになり、Simple Eagle が行っていた Content-Type のキャッシュ埋め込みが不要になる |
| `modificationTime` と `lastModified` が同値になる | プラグイン API には `modifiedAt` しかない。Lightbox の「更新日時」「最終変更」が同じ値を表示する |
| gzip 圧縮を JSON レスポンスに限定 | 画像（JPEG/webp）は圧縮済みで効果がなく CPU の無駄。Simple Eagle は全レスポンス対象だった |

## 3. 関連ドキュメント

- 目次: [CLAUDE.md](../../../CLAUDE.md)
- 全体方針・検証結果: [.claude/概要.md](../../概要.md)
- コーディング規約: [.claude/specs/coding.md](../coding.md)
- Eagle API の実挙動: [.claude/specs/plugin-test.md](../plugin-test.md)
- 実装知見: [.claude/knowledge.md](../../knowledge.md)
- 移植元:
  - `~/work/AI/Eagle関連/simple-eagle/index.py`（エンドポイント定義）
  - `~/work/AI/Eagle関連/simple-eagle/modules/eagle_api.py`（Eagle Web API 呼び出し）
  - `~/work/AI/Eagle関連/simple-eagle/modules/util.py`（画像圧縮・キャッシュ）
  - `~/work/AI/Eagle関連/simple-eagle/src/js/composables/useEagleApi.ts`（フロントが期待するインターフェース）
  - `~/work/AI/Eagle関連/simple-eagle/src/js/types.ts`（`TImageItem` / `TFolderItem`）
- 流用できる検証済みコード: `plugin-test/js/main.js` の
  `startServer()` / `serveStatic()` / `resolvePluginRoot()` / `compressItem()` / `isBootstrapping`

## 4. 機能要件

1. **サーバーライフサイクル**
   - Eagle 起動時（`onPluginCreate`）に `localStorage` の設定を読み、`serverEnabled` が true なら
     HTTP サーバーを `0.0.0.0:{port}` で起動する（デフォルトポート 8000）
   - サーバーの起動・停止を関数として提供する（ステータスウィンドウの ON/OFF トグルから呼ばれる）
   - `onPluginRun` の起動時自動発火をガードする（`isBootstrapping`。検証済みの方式）
2. **API**（詳細は「6. HTTP エンドポイント」）
   - 画像一覧・フォルダ一覧・サムネイル配信・画像配信（圧縮つき）・アイテム更新・ゴミ箱へ移動
3. **静的配信**
   - `plugin/public/` 配下を配信する。SPA のため、実在しないパスは `index.html` を返す（Vue Router 対応）
4. **圧縮画像キャッシュ**
   - 圧縮した画像を OS の一時ディレクトリにファイルキャッシュする（有効期限 1 時間）
5. **gzip 圧縮**
   - JSON レスポンスは 1KB 以上かつクライアントが `Accept-Encoding: gzip` を送る場合に gzip で返す
     （Simple Eagle の GZipMiddleware 相当。一覧 JSON の転送量削減）
6. **ログ**
   - リクエスト・エラーを直近 200 件のログに記録する（ステータスウィンドウが表示する。記録機構はここで実装）

## 5. 実行環境

**プラグイン側のみ**（`plugin/js/`。Node.js + `eagle.*` API が使える）。

- フロントエンド（`frontend/` → ビルドして `plugin/public/`）はこの仕様のスコープ外。
  ただし配信の仕組み（静的配信・SPA フォールバック）はこの仕様に含む
- 画像変換（OffscreenCanvas）はプラグインのレンダラー上で実行する

### ディレクトリ構成（この仕様で作る部分）

```
plugin/
  manifest.json         … serviceMode: true / devTools: true（開発中のみ。配布時は false にする）
  index.html            … ステータスウィンドウ（この仕様では最小限のガワのみ）
  js/
    main.js             … エントリポイント。ライフサイクルイベントの結線のみ
    settings.js         … localStorage の設定読み書き
    logger.js           … ログ機構（直近200件）
    server.js           … HTTP サーバー本体（起動・停止・ルーティング・gzip）
    static.js           … 静的配信（トラバーサル対策・SPAフォールバック）
    eagle-adapter.js    … eagle.* API のラッパー（Web API 互換形式へのマッピング）
    image.js            … 画像読み込み・OffscreenCanvas 圧縮・キャッシュ
  public/               … フロントエンドのビルド成果物（この仕様では動作確認用の仮ページ）
  package.json          … 依存: qrcode（この仕様では未使用。ウィンドウ仕様で使う）
```

## 6. HTTP エンドポイント

プレフィックスは Simple Eagle と同じ **`/api/eagle`**（フロント無改変で流用するため）。

認証はこの仕様では実装しないが、**全リクエストがルーティング前に通る単一の前段フック**を設け、
認証仕様（別途 `backend/auth.md`）が後から差し込めるようにする。

**エラー時の共通仕様**：ボディは `{ "status": "error", "message": "..." }` に統一する。
HTTP ステータスは、指定されたリソースが存在しない場合は 404、それ以外の失敗は 500
（フロントは `response.ok` と `data.status` の両方を見るため、どちらの形でも動作する）。

疎通確認用に `GET /api/ping`（`{ "status": "ok" }` を返す）を設ける。
`/ping` ではなく `/api/ping` とするのは、coding.md「API のパスは `/api/` 配下にまとめる」の規約と、
6.8 の「`/api/` 以外はすべて静的配信」に一致させるため。

### 6.1 `GET /api/eagle/list` — 画像一覧

| パラメータ | 型 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `limit` | int | 200 | 1 ページの件数（フロントは 600 を渡す） |
| `offset` | int | 0 | **ページ番号**（アイテム数ではない。スキップ件数 = `offset × limit`） |
| `orderBy` | string | なし | 受け取るが現状フロント未使用（オープン課題参照） |
| `keyword` | string | なし | キーワード検索 |
| `ext` | string | なし | 拡張子フィルタ |
| `tags` | string | なし | タグフィルタ（カンマ区切り） |
| `folders` | string | なし | フォルダ ID フィルタ（カンマ区切り） |

処理：

1. `eagle.item.get()` に条件を渡す
   - `tags` / `folders` はカンマ区切り文字列で届くため、**配列に分割してから**渡す
   - **`keyword`（単数）はプラグイン API では無視される**ため、`keywords: [keyword]` に変換する
   - 値が空の条件はキー自体を渡さない（`undefined` を渡すと挙動が不定になるため）
2. 並べ替え・`offset × limit` のスキップ・`limit` 件の切り出しは **JS 側で行う**
   （プラグイン API に `orderBy` / `limit` / `offset` が存在しないため）
3. 並び順は **`importedAt` の降順**（＝追加日時の降順）。プラグイン API のデフォルトも同じだが、
   保証された仕様ではないため明示的にソートする
4. 各 item を**レスポンスマッピング**（後述 8.1）で Web API 互換の形に変換する
5. 初版では毎リクエストで全件取得する（実測 2〜4 万件でも許容と判断）。体感で遅い場合は
   `fields` パラメータで返却フィールドを絞る最適化を検討する（オープン課題参照）

レスポンス（Simple Eagle 互換）：

```json
{ "status": "success", "data": [ { "id": "...", "name": "...", "star": 0, ... } ] }
```

- `star` は **int で返す**（未設定は 0。Simple Eagle が Python 側で int 変換していた挙動を維持）
- エラー時は `{ "status": "error", "message": "..." }`（フロントは `data.status === 'error'` を見る）

### 6.2 `GET /api/eagle/folders` — フォルダ一覧

- `eagle.folder.getAll()` で取得し、`TFolderItem` 互換へマッピングして
  `{ "status": "success", "data": [...] }` で返す
- フロントが実際に使うのは **`id` / `name` / `children` / `imageCount` の 4 つのみ**
  （folderTree コンポーネントで確認済み）。残りのフィールド（`description` / `tags` 等）は
  型を満たすだけの空値でよい
- **`imageCount` はプラグイン API に存在しない**（実機調査で確定）。
  `eagle.item.get({})` で全件取得し、各 item の `folders` 配列を集計して
  フォルダ ID ごとの件数を数える。**1 回の全件取得で全フォルダ分を数えられる**
  （フォルダごとに `get({folders:[id]})` を呼ぶとフォルダ数だけ全件走査が走るため避ける）
- `imageCount` は「そのフォルダ直下の件数」。子フォルダ分の合算はフロントが行う
  （`calculateTotalImageCount()`）ため、サーバー側では合算しない
- `modificationTime` にはフォルダの `createdAt` を入れる（フォルダに更新日時が無いため）

### 6.3 `GET /api/eagle/get_thumbnail_image?id={id}` — サムネイル配信

- `eagle.item.getById(id)` → `item.thumbnailPath` を `fs` で読んでバイナリを返す
- サムネイルが無いアイテム（`noThumbnail` が true）は `filePath` をそのまま返す
- `Content-Type` は拡張子から判定（webp / png / jpg / gif。それ以外は `application/octet-stream`）
- アイテムが存在しない・ファイル実体が無い場合は 404
  （Simple Eagle は例外処理の作りにより 500 になっていたが、404 が正しいのでここは挙動を改める）
- 50MB 超の拒否は 6.4 と共通で適用する（サムネイルで超えることは実質ないが、移植元の
  `load_image()` 共通の挙動を維持する）

### 6.4 `GET /api/eagle/get_image?id={id}&ext={ext}&max_file_size={KB}&quality={q}` — 画像配信（圧縮つき）

| パラメータ | 既定値 | 説明 |
| --- | --- | --- |
| `ext` | `png` | 互換のため受け取るが**使用しない**（`filePath` から直接読むため不要になった） |
| `max_file_size` | 1480 | この KB を超えたら JPEG 圧縮する。0 なら圧縮しない |
| `quality` | 85 | JPEG 品質。0 は 85 と同義 |

処理（Simple Eagle の `load_image()` の挙動を移植）：

1. `item.filePath` のファイルサイズを確認。**50MB 超は 500 エラーで拒否**
2. `max_file_size > 0` かつ超過している場合のみ圧縮する：
   - キャッシュにあれば（後述 6.7）キャッシュから返す
   - 元ファイルのサイズに応じて最大解像度を決める：10MB 超 → 2048px / 5MB 超 → 3072px / それ以下 → 4096px
   - `fs.readFileSync(filePath)` → `Blob` → `createImageBitmap()` → `OffscreenCanvas` で
     リサイズ + JPEG 変換（`fetch()` は `file://` 不可のため必ず `fs` 経由）
   - JPEG は透過を持てないため、**描画前にキャンバスを白で塗りつぶす**
     （Simple Eagle の「白背景合成」の再現。塗らないと透過部分が黒くなる）
   - 変換結果をキャッシュに保存して返す（`Content-Type: image/jpeg`）
   - **変換に失敗したら元ファイルをそのまま返す**（Simple Eagle のフォールバックを維持）。
     **フォールバック結果はキャッシュしない**（元ファイルを読むだけなのでキャッシュしても
     速くならず、ディスクの重複になるだけ。コストはリクエストごとのデコード失敗の試行のみ）
3. 圧縮不要なら元ファイルをそのまま返す

### 6.5 `POST /api/eagle/update` — アイテム更新

リクエスト：`{ "id": "...", "tags"?: string[], "annotation"?: string, "url"?: string, "star"?: number }`

- `eagle.item.getById(id)` → 送られてきたプロパティだけを代入 → `await item.save()`
  （`folders` の書き換えと同じ方式。`save()` の動作は T6 で検証済み）
- 成功時は `{ "status": "success" }`、失敗時は `{ "status": "error", "message": "..." }`

### 6.6 `POST /api/eagle/move_to_trash` — ゴミ箱へ移動

リクエスト：`{ "itemIds": string[] }`

- `eagle.item.getById(id)` → `await item.moveToTrash()`（実機調査でメソッドの実在を確認済み）
- Web API へのフォールバックは不要
- 成功時は `{ "status": "success" }`、失敗時は `{ "status": "error", "message": "..." }`

### 6.7 圧縮画像キャッシュ

- 保存先：`path.join(os.tmpdir(), 'mobile-eagle-cache')`
- キー：`filePath + ファイル更新時刻(mtime) + max_file_size + quality` の MD5（Node の `crypto` で生成）
  - mtime を含むため、元画像が更新されたら自動的にキャッシュミスになる
  - filePath を含むため、ライブラリをまたいだキーの衝突は起きない
- 有効期限：1 時間（読み込み時に mtime で判定）
- 掃除：リクエスト処理の 1% の確率で期限切れファイルを削除（Simple Eagle の方式を踏襲）
- キャッシュファイル形式：JPEG バイナリをそのまま保存。**キャッシュに入るのは圧縮成功時の
  JPEG のみ**（フォールバック結果はキャッシュしない。6.4 参照）ため、Content-Type は常に
  `image/jpeg` で確定し、Simple Eagle のような Content-Type 埋め込みは不要
- **ライブラリ切り替え時（`onLibraryChanged`）はキャッシュを全削除する**
  （キー衝突は起きないが、旧ライブラリのキャッシュは再利用されずディスクの無駄になるため）

### 6.8 静的配信（`/api/` 以外のすべてのパス）

1. パスが `/api/` で始まる場合、未定義エンドポイントなら 404（JSON）
2. `plugin/public/` 配下に実在するファイルならそれを返す
3. 実在しないパスは `public/index.html` を返す（Vue Router の履歴モード対応）
4. **`public/` の外に出るパスは 403**（`plugin-test` で検証済みのトラバーサル対策を必ず入れる）

## 7. UI 仕様

UI 変更なし（ステータスウィンドウの UI は別仕様）。
この仕様では `plugin/index.html` は最小限のガワ（ログを流すだけ）とし、動作確認は curl / ブラウザで行う。

## 8. データ構造・Eagle API の利用

### 8.1 レスポンスマッピング（プラグイン API → Web API 互換）

フロントの `TImageItem` が期待するフィールドに合わせる。

プロパティの実在はすべて実機調査で確認済み。

| レスポンスのキー | プラグイン API の元プロパティ | 備考 |
| --- | --- | --- |
| `id` / `name` / `size` / `ext` | 同名 | |
| `width` / `height` / `folders` / `tags` | 同名 | |
| `annotation` / `url` | 同名 | |
| `star` | `star` | **int に変換**。評価なしのとき `undefined` が返るため 0 にする |
| `modificationTime` | `modifiedAt` | **名前が違う**。数値（ミリ秒） |
| `lastModified` | `modifiedAt` | 同上（フロントの型に存在するため両方返す。値は同一） |

**欠損値のデフォルト**：`annotation` / `url` は空文字、`tags` / `folders` は空配列で埋める。
特に `annotation` は、フロントが null ガードなしで `image.annotation.toLowerCase()` を呼ぶ箇所が
あるため（`ImageListView.vue:143`）、**undefined のまま返すとフロントがクラッシュする**。

### 8.2 使用する Eagle API

- `eagle.item.get(条件)` / `eagle.item.getById(id)` / `item.save()`
- `eagle.folder.getAll()`
- `eagle.window` / `eagle.dialog`（重大エラー通知。9 章）
- `eagle.onPluginCreate` / `onPluginRun` / `onLibraryChanged`

### 8.3 localStorage のキー

設定は単一キー **`mobile-eagle-settings`** に JSON で保存する（項目追加に強くするため）。

```json
{
  "serverEnabled": true,
  "port": 8000,
  "selectedIp": "",
  "password": ""
}
```

- この仕様で**読み書きするのは** `serverEnabled` / `port` のみ。
  `selectedIp` / `password` は構造だけ定義し、ウィンドウ仕様・認証仕様が使う
- 初回起動（キーが無い）は上記のデフォルト値で作成する

## 9. エッジケース・エラー処理

| ケース | 挙動 |
| --- | --- |
| ポート使用中（`EADDRINUSE`） | **重大エラー**：ログ記録 + `eagle.window.show()` + `showMessageBox()` |
| サーバー起動中に設定ポートを変更 | この仕様では対象外（ウィンドウ仕様で「停止 → 起動」として扱う） |
| アイテム ID が存在しない | 404。`{ "status": "error", "message": "..." }` |
| `filePath` の実体が無い（外部ボリューム切断など） | 404。軽微エラーとしてログのみ |
| 画像のデコード失敗（壊れたファイル） | 圧縮を諦めて元ファイルを返す（フォールバック） |
| 50MB 超のファイル | 500 で拒否（Simple Eagle と同じ） |
| ライブラリ切り替え | サーバーは継続（検証済み）。キャッシュを全削除。処理中のリクエストは結果不定でよい |
| `onLibraryChanged` の起動直後の発火 | 初期化と二重にならないようガードする（キャッシュ削除をスキップ） |
| リクエストハンドラ内の未捕捉例外 | 500 を返しログに記録。**サーバーを落とさない** |
| Eagle 終了 | プロセスごと終了するため後始末は不要 |

## 10. セキュリティ

- 静的配信のディレクトリトラバーサル対策（6.8。実装は `plugin-test` の検証済みコードを流用）
- `plugin/public/` に秘密情報を置かない
- 認証は別仕様（`backend/auth.md`）。この仕様では前段フックの挿入点だけ設ける（6 章冒頭）
- Web API（`localhost:41595`）は原則使用しない（6.6 の代替案を採用した場合のみ例外）

## 11. スコープ外

- パスワード認証（→ `backend/auth.md` として別途仕様化）
- ステータスウィンドウの UI（QR コード・IP 選択・ON/OFF トグルなど → 別途仕様化）
- フロントエンドの移植（Vue 3 SPA → 別途仕様化。この仕様では動作確認用の仮ページのみ）
- CORS ヘッダー（本番は同一オリジンなので不要。フロント開発時に Vite dev サーバーから
  プラグインの API を叩く場合に必要になる可能性があるが、フロント移植の仕様で扱う）
- フォルダ移動 API（Simple Eagle に無い新機能 → フロント対応とあわせて別途仕様化）
- ゴミ箱内アイテムの閲覧（**Eagle API の制約により実装不可**。検証済み）
- 動画対応（Simple Eagle も未対応）

## 12. 実装ステップ

機能を上から順に実装する。各「📌 コミットポイント」は動作を確認できる区切りで、
ユーザーのレビュー後に `/step-commit` でコミットすることを想定している。

- [x] 1. `plugin/` の雛形を作る（`manifest.json` / 最小限の `index.html` / `main.js` の
  ライフサイクル結線 / `logger.js`。`isBootstrapping` ガードを含む）
- [x] 2. `settings.js`（localStorage 読み書き・デフォルト値）と `server.js`（起動・停止・
  `EADDRINUSE` 処理・`GET /api/ping`）を実装し、`onPluginCreate` から自動起動する

> 📌 **コミットポイント 1** — プラグインを Eagle に読み込むと HTTP サーバーが自動起動し、
> `curl http://localhost:8000/api/ping` が返る。ポート衝突時にエラーダイアログが出る
> → ユーザーがチェック → `/step-commit` でコミット

- [x] 3. `static.js`（静的配信・トラバーサル対策・SPA フォールバック）と、動作確認用の
  仮 `public/index.html` を実装する

> 📌 **コミットポイント 2** — スマホから仮ページが表示される。`/../manifest.json` への
> curl --path-as-is が 403 を返す
> → ユーザーがチェック → `/step-commit` でコミット

- [x] 4. `eagle-adapter.js` のマッピング層（item → `TImageItem` 互換 / folder → `TFolderItem` 互換）を
  実装する。**このステップで未検証プロパティ（8.1 の表）とフォルダの `imageCount` の
  実機確認も行い、結果を plugin-test.md か knowledge.md に記録する**
- [x] 5. `GET /api/eagle/list`（フィルタ + JS ソート + ページング）と `GET /api/eagle/folders` を実装する
- [x] 6. JSON レスポンスの gzip 圧縮を実装する

> 📌 **コミットポイント 3** — curl で `list` / `folders` が Simple Eagle 互換の JSON を返す。
> `offset` がページ番号として機能する（`offset=1&limit=10` で 11 件目からが返る）。
> `keywords` / `tags` / `folders` フィルタと並び順の実機確認結果が記録されている
> → ユーザーがチェック → `/step-commit` でコミット

- [x] 7. `GET /api/eagle/get_thumbnail_image` を実装する
- [x] 8. `image.js`（`fs` 読み込み → OffscreenCanvas 圧縮 → キャッシュ）と
  `GET /api/eagle/get_image` を実装する。`onLibraryChanged` でのキャッシュ全削除もここで実装する

> 📌 **コミットポイント 4** — スマホ（または curl）でサムネイルと拡大画像が取得できる。
> 大きい画像が JPEG 圧縮され、2 回目のアクセスがキャッシュから返る（ログで確認）
> → ユーザーがチェック → `/step-commit` でコミット

- [x] 9. `POST /api/eagle/update` を実装する
- [x] 10. プラグイン API の削除手段（`item.moveToTrash()` 等）を実機確認し、
  `POST /api/eagle/move_to_trash` を実装する

> 📌 **コミットポイント 5** — ⭐評価の変更とゴミ箱への移動が Eagle 本体に反映される。
> バックエンド基盤の完成
> → ユーザーがチェック → `/step-commit` でコミット

## 13. オープン課題

### 解決済み（Step 4 の実機調査で確定・2026-07-09）

- [x] **フォルダに `imageCount` は無い**。持つのは `id` / `name` / `description` / `children` /
  `createdAt` / `parent` / `icon` / `iconColor` の 8 つのみ
  → **代替**：`eagle.item.get({})` で全件取得し、各 item の `folders` を集計して数える
  （1 回の全件取得で全フォルダ分を数えられる。フォルダごとに `get({folders:[id]})` を呼ぶと
  フォルダ数だけ全件走査が走るため避ける）
- [x] **item の未検証プロパティはすべて実在**：`modifiedAt` / `noThumbnail` / `thumbnailPath` /
  `annotation` / `url` / `tags`。ただし **`star` は評価なしのとき `undefined`**（`0` ではない）
- [x] **`keyword`（単数）は無視される**。全件が返る。**`keywords`（配列）を使う**こと。
  Simple Eagle は Web API の `keyword` を使っていたので、`keywords: [keyword]` に変換する
- [x] **`folders` フィルタは機能する**（実測で 421 件に絞り込まれた）
- [x] **`tags` フィルタは機能する**（実測で `tags=NovelAI` が正しく絞り込まれた）
- [x] **`item.moveToTrash()` は存在する**。Web API フォールバックは不要
- [x] **デフォルトの並び順は `importedAt` の降順**（＝追加日時の降順）。Simple Eagle と一致する。
  item が持つ日時は `importedAt` / `modifiedAt` の 2 つだけで、`lastModified` /
  `modificationTime` / `btime` / `mtime` は存在しない

### 未解決

- [ ] `orderBy` パラメータの扱い（フロントは現在未使用。当面は「受け取るが無視」とし、
  フロント側で使う時に実装する想定）
- [ ] `/list` `/folders` の性能（毎リクエスト全件取得。実測 2〜4 万件で問題が出た場合、
  `fields` パラメータでの返却フィールド絞り込み、または取得結果の短時間メモリキャッシュを検討）
- [ ] **`imageCount` の二重計上**（移植元から引き継いだ挙動）。フロントの
  `calculateTotalImageCount()` は子孫の件数を親に足し込むが、**同じ画像が親と子の両方の
  フォルダに属している場合、二重に数える**。Simple Eagle も同じ挙動なので当面そのままとする。
  直す場合は、サーバー側で `descendantImageCount`（現在は未使用の空フィールド）に
  重複を除いたユニーク件数を入れ、フロント側でそちらを参照するよう変更する
