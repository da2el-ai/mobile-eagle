# 実装知見

実装で詰まったこと、公式ドキュメントと違った挙動、回避策とその理由を記録する。

**WHAT（何を実装したか）は書かない。** コミットメッセージで十分。
ここには**発見・罠・回避策の理由**だけを書く。

記録は `/step-commit` の中で行う。

---

## Eagle Plugin API

### `onPluginRun` は Eagle 起動時にも発火する

公式ドキュメントには「ユーザーがプラグインパネルでクリックしたときに呼ばれる」とあるが、
実際には **Eagle 起動時（`onPluginCreate` の 8ms 後）にも自動発火する**。

ここで無条件に `eagle.window.show()` を呼ぶと、Eagle を起動するたびにプラグインウィンドウが
勝手に開いてしまう。`onPluginCreate` からの経過時間（3秒）で自動発火とユーザー操作を区別し、
自動発火なら `eagle.window.hide()` を呼ぶ。

→ 検証ログ：[specs/plugin-test.md](specs/plugin-test.md) の T1

### `DOMContentLoaded` は `onPluginCreate` の非同期処理完了を待たない

ステータスウィンドウの UI 初期化を `DOMContentLoaded` で行うと、その時点では
`onPluginCreate` 内の `await ME.server.start()` がまだ完了していないことがある
（両者の発火順序は保証されない）。この状態で `ME.server.isRunning()` を読むと `false` が返り、
**「サーバーは自動起動しているのに、トグルは OFF のまま固定」**になる（実機で発生）。

**回避策**：サーバーの起動/停止は必ずログ（`ME.logger`）を伴うので、`ME.logger.subscribe()` の
コールバックで `isRunning()` の変化を監視し、変化時に状態表示・QR を更新する。
`init` 時のスナップショットだけに頼らないこと。状態変化のたびに毎回 QR を作り直さないよう、
前回の稼働状態を覚えておき**変化時のみ**再描画する。

### `eagle.item.get()` に `orderBy` / `limit` / `offset` は存在しない

Eagle Web API（`localhost:41595`）にはあるが、プラグイン API にはない。
数万件を一度に返すため、並べ替えと件数制限は JS 側で行う。

### `keyword`（単数）は無視される。`keywords`（配列）を使う

`eagle.item.get({ keyword: 'a' })` は**パラメータが無視され全件（19,142件）が返る**。
`eagle.item.get({ keywords: ['a'] })` なら正しく絞り込まれる（14,854件）。

Simple Eagle は Web API の `keyword`（単数）を使っていたので、移植時は
**`keywords: [keyword]` に変換する必要がある**。

なお `ext` / `tags` / `folders` フィルタは実測でいずれも正しく機能する。
無視されるのは `keyword`（単数）だけ。

### `folder` に `imageCount` は無い

フォルダオブジェクトが持つのは `id` / `name` / `description` / `children` / `createdAt` /
`parent` / `icon` / `iconColor` の 8 つだけ。Web API の `folder/list` にあった `imageCount` が無い。

フォルダごとの件数が要るときは、`eagle.item.get({})` で全件取得し、
各 item の `folders` 配列を集計して数える（1 回の全件取得で全フォルダ分を数えられる）。
フォルダごとに `eagle.item.get({folders:[id]})` を呼ぶとフォルダ数だけ全件走査が走るため避ける。

**API が返す `imageCount` は「そのフォルダ直下の件数」で、子孫は含まない。**
子孫の合算はフロントの `calculateTotalImageCount()` が行うため、サーバー側で子孫を含めると
二重計上になる。curl で API を直接叩くと子孫を含まない数字が見えるが、これが正しい
（Web API の `folder/list` と同じ意味）。

### `eagle.folder.getById()` は見つからないと falsy を返す（例外は投げない）

存在しない folderId を渡すと `null`（または `undefined`）が返り、例外は投げられない。
公式ドキュメントは戻り値を `Promise<Folder>` としか書いておらず、見つからない場合の挙動は未記載。
フォルダ移動（`POST /move_to_folder`）の移動先実在確認に使うため実機で確認した：
存在しない ID には 404「フォルダが見つかりません」、実在 ID では移動が成功した。

→ **不正な folderId のまま `item.folders = [folderId]` で `save()` すると、アイテムが
どのフォルダにも表示されなくなる。** この事前確認（`getById` の falsy 判定）は消さないこと。

### `item.star` は評価なしのとき `undefined`（0 ではない）

`0` が入っているわけではないので、`item.star || 0` のような正規化が必須。
そのまま返すとフロントの型（`star?: number`）は通るが、評価フィルタが壊れる。

### `eagle.item.get({})` のデフォルト並び順は `importedAt` の降順

明示的なソート指定がなくても追加日時の新しい順で返る（実測で確認）。
Simple Eagle が Web API のデフォルト順で表示していたものと一致する。

item が持つ日時プロパティは **`importedAt` と `modifiedAt` の 2 つだけ**。
`lastModified` / `modificationTime` / `btime` / `mtime` は**存在しない**（フロントの型に
`modificationTime` / `lastModified` があるが、これは Web API 由来の名前なのでマッピングが要る）。

### `item.moveToTrash()` は存在する

item のメソッドは `addComment` / `moveToTrash` / `open` / `refreshThumbnail` / `removeComment` /
`replaceFile` / `save` / `select` / `setCustomThumbnail` / `setDirty` / `updateComment`。

削除のために Web API（`localhost:41595`）へフォールバックする必要はない。
**ただしゴミ箱への「移動」ができるだけで、ゴミ箱の中身は依然として取得できない。**

実機で確認した挙動：`await item.moveToTrash()` の後、そのアイテムは `eagle.item.get({})` の
結果から消える。**`eagle.item.getById(id)` も null を返すようになる**（ゴミ箱のアイテムは
ID を知っていても取得できない）。

### ゴミ箱内のアイテムは取得できない

`isDeleted` プロパティは存在するが**常に `false`**。検索条件 `get({isDeleted: true})` は
**パラメータ自体が無視され**、通常の全件が返る。ゴミ箱に 661 件ある状態で取得 0 件を確認済み。

`metadata.json` を直接読む回避策はあるが、公式が「`item` API の `save()` を使い
`metadata.json` を直接操作しないこと」と明記しているため採用しない。

### `fetch()` は `file://` を扱えない

Chromium の制約。`item.fileURL` を `fetch()` しても失敗する。
画像を読むときは `fs.readFileSync(item.filePath)` → `Blob` → `createImageBitmap()` の経路を使う。

### `OffscreenCanvas` は通常の `<canvas>` より速い

4〜5MB の webp を長辺 2048px・JPEG 品質 85 に変換した実測で、**全件で OffscreenCanvas が高速**
（27〜40ms vs 31〜58ms）。**出力サイズは完全に同一。**
処理時間の内訳は読込（デコード）が支配的（95〜118ms）。

Pillow / sharp のようなネイティブ依存は不要。

### JPEG 変換の前にキャンバスを白で塗る

JPEG は透過を持てない。`OffscreenCanvas` は初期状態が透明なので、**塗らずに `drawImage()` すると
元画像の透過部分が黒くなる**。`ctx.fillStyle = '#ffffff'` → `fillRect()` してから描く
（Simple Eagle が Pillow でやっていた白背景合成の再現）。

透過 PNG（`logo_d2@2x_white`）で実測し、完全透明だった 200 箇所すべてが白、黒は 0 箇所であることを確認済み。
**この `fillRect()` は消さないこと。** 一見すると不要な処理に見えるが、消すと透過画像が黒く潰れる。

### ファイアウォールの許可ダイアログが出ない

プラグインは Eagle 本体のプロセス内で動くため、Eagle が取得済みの許可がそのまま使われる。
`0.0.0.0` にバインドしても macOS の許可ダイアログは表示されなかった。
**ユーザーの追加操作なしに LAN 公開できる。**

### `.eagleplugin` にフロントエンドを同梱できる

パッキングするとプラグインフォルダの中身ごとアーカイブされ、インストール後も
プラグインフォルダから読み出して HTTP 配信できる。パッキング前後で挙動は変わらない。

---

## HTTP サーバー

### ボディサイズ超過で `req.destroy()` を呼ぶと 400 が届かない

`req.on('data')` の中でサイズ上限を超えたときに `req.destroy()` すると、
**レスポンスを書き込む前にソケットが閉じる**ため、クライアントには
「400 Bad Request」ではなく接続エラー（`UND_ERR_SOCKET` / `other side closed`）が届く。

`req.pause()` で読み取りだけ止めて reject し、通常のエラー経路で 400 を返す。

---

## セキュリティ

### ブラウザからは `../` のトラバーサルを検証できない

ブラウザは送信前に URL を正規化するため、`http://host:8000/../manifest.json` は
`/manifest.json` としてサーバーに届く。**403 ではなく 404 が返るのが正常。**

ガードが効いているかを確かめるには `curl --path-as-is` のように正規化しないクライアントを使う。
実機で `/../js/main.js` や `/../../../../etc/passwd` が 403 になることを確認済み。

**LAN に公開する以上、正規化しないクライアントからのアクセスは想定すべき。**
このガードは必ず入れること（消さないこと）。

---

## 環境

### `localStorage` が設定の永続化に使える

`serviceMode` のプラグインでも、Eagle 起動時にレンダラーごとロードされるため
`onPluginCreate` の時点で同期的に読み出せる（DOM 構築を待つ必要がない）。

### Tailscale の仮想インターフェースは遅れて現れることがある

OS ログイン直後だと、Eagle 起動時点で `utun*` がまだ `os.networkInterfaces()` に現れていない
可能性がある。起動直後に 1 回だけ判定すると誤検知するため、数秒おきに数回リトライしてから判定する。

---

## フロントエンド（Vite + Vue 3）

### `vue-tsc -b`（型チェック）が作業ツリーを汚す

`tsconfig.node.json`（`vite.config.ts` を含む composite プロジェクト）は
`noEmit: true` にできない（`error TS6310: Referenced project may not disable emit`）。
そのまま `vue-tsc -b` を実行すると、リポジトリ直下に `vite.config.js` / `vite.config.d.ts` /
`*.tsbuildinfo` が生成され、`git status` に混入する。

**対策**：`tsconfig.node.json` の `outDir` を `./node_modules/.tmp/tsc-node` に逃がし、
`*.tsbuildinfo`（root の solution 用に別途生成される）は `frontend/.gitignore` で除外する。
「なぜ outDir を node_modules に向けているのか」がすぐ分かるよう、この理由を残す。

### `vue-tsc -b` の実行後にこれらが再生成される点に注意

`yarn build`（`vue-tsc -b && vite build`）のたびに tsbuildinfo は再生成される。
gitignore しているので通常は問題ないが、`git clean` 等で消しても実害はない（キャッシュのため）。
