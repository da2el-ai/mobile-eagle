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

### `keywords` はファイル名しか見ない。`annotation` と併用すると AND になる

`eagle.item.get({ keyword: 'a' })`（単数）は**パラメータが無視され全件が返る**。
`keywords: ['a']`（配列）なら絞り込まれるが、**照合対象はファイル名（`name`）だけ**で、
メモ（`annotation`）もタグも対象外。実測（`keywords: ['screenshot']`）では name 一致の 24 件を
過不足なく返し、メモにだけ含む 4 件・タグにだけ含む 2 件はヒットしなかった。

`annotation` パラメータは公式ドキュメントどおり存在し、単独なら部分一致で正しく機能する
（`annotation: 'krea'` で 18 件 = 全件走査での集計と一致）。
**しかし `keywords` と併用すると AND になる。** name にだけヒットする語（`screenshot` = 24 件）と
annotation にだけヒットする語（`krea` = 18 件）を同時指定した結果は **0 件**だった
（OR なら 41 件前後になるはず）。同じ語を両方に指定した場合も、name と annotation の両方に
その語を含む 1 件だけが返った。

→ **「ファイル名 または メモ」を Eagle 側の条件で表現する方法は無い。**
そのため Mobile Eagle は `keyword` を condition に渡さず、`eagle-adapter.js` の
`matchesKeyword()` で JS 側照合している。挙動は Eagle 本体の検索窓に合わせた
（ファイル名 + メモ / 空白区切りは AND・順不同 / 大文字小文字を区別しない /
単語境界ではなく連続部分文字列で一致 / カンマは区切りではない）。
`/list` は元々全件走査しているため追加コストはほぼ無い。
**この自前照合を「API に任せられるのでは」と戻さないこと。**

なお `ext` / `tags` / `folders` フィルタは実測でいずれも正しく機能する。

### Web API（`localhost:41595`）では `keywords` / `name` が無視される

プラグイン API と**同じ名前のパラメータでも挙動が違う**。
Web API の `/api/v2/item/get?keywords=krea` は絞り込まれず**先頭 1000 件がそのまま返る**
（結果 1000 件のうち name にも annotation にも `krea` を含むものが 0 件だった）。
`name=krea` / `keyword=krea` も同様に無視される。`annotation=krea` だけは正しく 18 件に絞られる。

検索したのに「関係ないものばかり出てくる」ように見えるのは、フィルタが効かず
全件の先頭が返っているため。**Web API の結果を根拠にプラグイン API の実装を決めないこと。**

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

### `yarn build` は `plugin/public/`（旧アプリの配信物）を上書きする

`vite.config.ts` の `outDir` が `../plugin/public`・`emptyOutDir: true` なので、
**型チェックのつもりで `yarn build` を実行すると旧アプリが消える**（実際に踏んだ）。
新旧の並行稼働（`:8000` = 旧アプリ / `:5173` = Vite dev の新アプリ）は
バグ切り分けの前提なので、本ビルド切り替え（base.md 14 章の最終マイルストーン）までは実行しない。

型だけ確認したいときは `npx vue-tsc --noEmit -p tsconfig.json` を使う。

### `yarn dev` は Node v16 以下では起動できない

`crypto$2.getRandomValues is not a function` で落ちる（Vite 5 が `crypto.getRandomValues` を
要求するが、Node 16 では global に無い）。このマシンの nodebrew のデフォルトは v16 のため、
何もしなければ必ず踏む。

**対策**：`export PATH="$HOME/.nodebrew/node/v22.20.0/bin:$PATH"` を通してから
`yarn dev --host` を実行する。グローバル `fetch` を使うスモークテストも同様。

---

## グリッドビュー（描画方式）

### `content-visibility: auto` のセルを `repeat(N, 1fr)` に置くと列が画面外へはみ出す

`grid-template-columns: repeat(N, 1fr)` の `1fr` は **`minmax(auto, 1fr)` と等価**で、
列はセルの min-content 幅より細くならない。グリッドセルには `content-visibility: auto` と
セットで `contain-intrinsic-size`（幅・高さ）を指定しているため、
**画面外のセルはこの幅を min-content として主張する**。
結果、列数を増やしてもトラックが縮まず、増えた列がコンテナの外（画面右）へ押し出される。

症状が分かりにくい：`grid-template-columns` の値は正しいのに列が 1 つ少なく見え、
2 行目以降の並びがずれる。DevTools 上も値は正常に見えるため、原因に辿り着きにくい
（`margin-left: -100px` で画面外のセルを引き戻して初めて確定した）。

**対策**：`repeat(N, minmax(0, 1fr))` にして下限を外す（`components/grid/GridView.vue`）。
**`minmax(0, …)` を `1fr` に戻さないこと。** 一見冗長に見えるが、
`content-visibility` 方式（base.md 11 章）を採る限り必須。

### `<main>` の内部スクロールは親の高さが確定していないと成立しない

シェル（`App.vue` のルート）を `min-height: 100vh` にすると、中身が増えたときシェル自体が
伸びるため `flex-1` の `<main>` も伸び、`overflow-y: auto` が働かず window スクロールになる。
DOM 仮想化を捨てた代わりの `content-visibility` 方式は
「内部スクロールのコンテナ」を前提にしている（base.md 11 章）。

**対策**：`.app-shell { height: 100vh; height: 100dvh; }`（`css/main.css`）で高さを固定する。
`dvh` はモバイル Safari のアドレスバー伸縮に追随させるため。非対応環境は `vh` にフォールバックする。

### `IntersectionObserver` は交差状態が変わらないと再通知しない

無限スクロールの番兵は、1 ページ読んでも画面が埋まらない場合（大画面・列数が多い）に
可視のままとなり、追加の通知が来ないため続きを読めなくなる。

**対策**：ロード完了後に `unobserve()` → `observe()` で監視を張り直して再評価させる
（`GridView.vue` の `reobserveSentinel()`）。

---

## 仕様策定

### モックアップを一次情報にすると、移植元にあった機能が黙って落ちる

グリッドから子フォルダへ「潜る」導線（移植元 Simple Eagle の `ImageListFolder.vue`）が、
仕様書 6 本（base / grid / folder-tree / lightbox / settings / auth）のどこにも入っていなかった。
Claude Design 製モックアップ（`.claude/design/Mobile Eagle.dc.html`）にフォルダセルの markup が
無く、モックアップを一次情報として仕様を起こしたため、そのまま欠落した。
ユーザーが実機で「グリッドにフォルダが表示されない」と気付くまで発覚しなかった
（grid-2 完了後。仕様策定から実装 5 ステップぶん遅れて判明した）。

パンくずは「戻る」導線でしかなく、フォルダツリーは操作コストが高い。つまりこれは
装飾ではなく**「潜る」唯一の低コストな導線**であり、欠けたまま完成すると使い勝手を大きく損なう。

**モックアップはレイアウト・数値の一次情報ではあるが、機能の網羅性の一次情報ではない。**
新しいビューの仕様を起こすときは、モックアップに加えて
**移植元 `~/work/AI/Eagle関連/simple-eagle` の対応コンポーネントを必ず読み、
「モックアップに無いが移植元にある機能」を一つずつ採否判断する**こと。
意図的に落とす場合は、その旨と理由を仕様書に書き残す
（folder-tree.md の「モックアップは『すべて』をツリーのルートにしているが踏襲しない」のように）。
残る lightbox / settings も同じ穴が空いている可能性がある。
