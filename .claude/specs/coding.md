# コーディング規約

Mobile Eagle（Eagle プラグイン）のコーディング規約。

## 1. 基本方針

- **検証済みの事実に基づいて書く。** Eagle Plugin API はドキュメントと実挙動が食い違う箇所がある（[plugin-test.md](plugin-test.md) 参照）。推測で実装せず、疑わしい場合は最小コードで確認する
- **Simple Eagle（`/Volumes/D/works/simple-eagle`）からの移植** が基本。挙動を変える場合は理由を明記する
- 分からないことは勝手に推測せず、ユーザーに確認する

## 2. 共通ルール

- 文章・コメント・UI 文言・コミットメッセージはすべて **日本語**
- インデントは **2 スペース**
- 文末のセミコロンは付ける
- 1 行の目安は 120 文字
- ファイル名は kebab-case（`image-cache.js`）。Vue コンポーネントのみ PascalCase（`ImageListView.vue`）

### コメント

- **コードを読めば分かることは書かない。** 「なぜそうしたか」だけを書く
- 特に **Eagle API の落とし穴に対する回避策には必ず理由を書く**（後から読んだ人が「不要では？」と削除するのを防ぐ）

```js
// ✅ 良い例：なぜこの処理が必要かが分かる
// Eagle 起動時にも onPluginRun が発火するため、ここで show() すると
// 毎回ウィンドウが勝手に開いてしまう
if (isBootstrapping) return;

// ❌ 悪い例：コードを読めば分かる
// isBootstrapping が true なら return する
if (isBootstrapping) return;
```

## 3. ディレクトリ構成

```
mobile-eagle/
  plugin/           … 配布するプラグイン本体（.eagleplugin にパッキングする単位）
    manifest.json
    index.html      … ステータスウィンドウ
    js/             … プラグイン側（Node.js が使える）
    css/
    public/         … フロントエンドのビルド成果物（HTTP配信される）
    package.json
  frontend/         … フロントエンドのソース（Vite でビルドし plugin/public へ出力）
  plugin-test/      … 検証用プラグイン（使い捨て。本実装には含めない）
  .claude/          … ドキュメント
```

> 構成は本実装の設計書で確定する。上記は暫定。

**重要**：`plugin/public/` 配下のファイルは HTTP 配信される。**秘密情報を置かない。**

## 4. 実行環境の区別

Mobile Eagle には**実行環境の異なる 2 種類の JavaScript** がある。混同しないこと。

| | プラグイン側（`plugin/js/`） | フロントエンド側（`frontend/`） |
| --- | --- | --- |
| 実行場所 | Eagle 内（Chromium 107 + Node.js 16） | スマホのブラウザ |
| 使えるもの | `eagle.*` API、Node.js（`fs` / `http` / `os`）、npm モジュール | 標準の Web API のみ |
| 使えないもの | — | `eagle.*`、Node.js の API |
| 通信 | HTTP サーバーを提供する | `fetch()` で同一オリジンの API を呼ぶ |

## 5. JavaScript / TypeScript

- プラグイン側は **素の JavaScript**（ビルド不要にするため）。TypeScript は使わない
- フロントエンド側は **TypeScript**
- `var` は使わない。再代入しないものは `const`
- 非同期処理は `async` / `await`。`.then()` チェーンは使わない
- `==` ではなく `===`
- 例外は握りつぶさない。必ずログに残すか、ユーザーに伝える

### 命名

- 関数名は動詞から始める（`startServer()` / `resolvePluginRoot()`）
- 真偽値は `is` / `has` / `can` で始める（`isBootstrapping`）
- 定数は SCREAMING_SNAKE_CASE（`BOOTSTRAP_GRACE_MS`）

## 6. Eagle プラグイン固有の規約

**検証で判明した落とし穴。必ず守ること。** 根拠は [plugin-test.md](plugin-test.md)。

### 6.1 `onPluginRun` は Eagle 起動時にも発火する

公式ドキュメントの「ユーザーがクリックしたとき」という記述は**不正確**。ここで無条件に
`eagle.window.show()` を呼ぶと、Eagle 起動のたびにウィンドウが開いてしまう。

`onPluginCreate` からの経過時間で起動時の自動発火とユーザー操作を区別する。

```js
let isBootstrapping = true;

eagle.onPluginCreate(() => {
  setTimeout(() => { isBootstrapping = false; }, 3000);
});

eagle.onPluginRun(() => {
  if (isBootstrapping) {
    eagle.window.hide();  // 起動時の自動発火。ウィンドウは開かない
    return;
  }
  eagle.window.show();    // ユーザーのクリック
});
```

### 6.2 画像の読み込みは `fs` を使う

`fetch()` は `file://` スキームを扱えない。`item.fileURL` ではなく `item.filePath` から読む。

```js
const buffer = fs.readFileSync(item.filePath);
const bitmap = await createImageBitmap(new Blob([buffer]));
```

### 6.3 画像の変換は `OffscreenCanvas` を使う

通常の `<canvas>` より常に高速で、出力は同一。ネイティブモジュール（sharp）は使わない。

### 6.4 `eagle.item.get()` に `orderBy` / `limit` / `offset` はない

並べ替え・件数制限は JS 側で行う。数万件を一度に返すため、`fields` パラメータで
返却フィールドを絞ることを検討する。

### 6.5 ゴミ箱内のアイテムは取得できない

`isDeleted` は常に `false` を返し、検索条件としても無視される。**ゴミ箱閲覧は実装しない。**
`metadata.json` を直接読む回避策は、公式が非推奨としているため採用しない。

### 6.6 `onLibraryChanged` は Eagle 起動直後にも発火する

初期化処理と二重にならないようガードする。切り替え時はサーバー側のキャッシュを破棄する。

### 6.7 npm モジュールはピュア JS のものだけ

ネイティブバイナリを含むモジュールは Eagle の Node 16 / Electron ABI に合わせたビルドが必要になる。
`qrcode` のようなピュア JS のものを選ぶ。

## 7. HTTP サーバー / API

- サーバーは `0.0.0.0` にバインドする（全 IP で待ち受け）
- **静的ファイル配信では必ずディレクトリトラバーサル対策を入れる。** 配信ディレクトリの外に出るパスは
  403 で拒否する。プラグイン本体のコードや設定ファイルが読まれるのを防ぐ

```js
const normalized = path.normalize(path.join(publicDir, relativePath));
if (!normalized.startsWith(publicDir + path.sep) && normalized !== publicDir) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

- ポート使用中（`EADDRINUSE`）などの起動エラーは `server.once('error', ...)` で捕捉する
- レスポンスの `Content-Type` は拡張子から判定し、`charset=utf-8` を付ける
- API のパスは `/api/` 配下にまとめ、静的ファイルと衝突させない

## 8. 設定の永続化

- `localStorage` を使う（`serviceMode` でも `onPluginCreate` の時点で同期的に読める）
- 保存する項目：サーバーの ON/OFF、ポート番号、選択した IP アドレス、ログインパスワード
- パスワードは平文で保存する（VPN 前提の個人用ツールのため許容）
- ライブラリごとの設定分けは行わない

## 9. エラー処理とログ

| エラーの重大度 | 通知手段 |
| --- | --- |
| 重大（サーバー起動失敗など、機能が使えない） | `eagle.window.show()` + 画面内にエラー表示 + `eagle.dialog.showMessageBox()` |
| 軽微（個別リクエストの失敗など） | ログ（直近 200 件）に記録するのみ |

- `alert()` は使わない。挙動は `showMessageBox()` と同じだが制御性が低い
- `eagle.notification.show()` は時間経過で消えるため、重大エラーには使わない
- ログはタイムスタンプ付きで最新が上。直近 200 件を保持する

## 10. フロントエンド（Vue 3）

- 構成：Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS（Simple Eagle から流用）
- Composition API + `<script setup>` を使う
- 状態管理は Pinia。コンポーネント間で共有しない状態はローカルに置く
- API のベース URL は同一オリジン（`/api/`）
- スマホ表示が前提。タップ領域は 44px 以上を確保する

## 11. 禁止事項

- `plugin/public/`（HTTP 配信されるディレクトリ）に秘密情報を置かない
- `metadata.json` を直接書き換えない（必ず `item.save()` を使う）
- ネイティブバイナリを含む npm モジュールを使わない
- `console.log` をコミットに残さない（ログ機構を使う）
- 実装をいきなり始めない。**大きな機能は仕様書を起こしてから着手する**（`/create-spec`）
