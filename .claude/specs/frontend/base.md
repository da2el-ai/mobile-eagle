# フロントエンド基盤（全面書き直し） 仕様書

## 1. 概要

Simple Eagle から移植した Vue 3 SPA を、モックアップ（`.claude/design/`）に基づいて**ゼロから書き直す**。
この仕様書は全画面が共有する基盤を定義する：技術構成・ビルド・デザインシステム（テーマ）・
多言語対応・ルーティング・状態管理・API クライアント・バックエンド拡張。

画面ごとの仕様は分冊とし、本書を前提に参照する：

| 仕様書 | 対象 |
| --- | --- |
| [grid.md](grid.md) | グリッドビュー（ヘッダー・パンくず・サムネイルグリッド・フィルタ・複数選択・フォルダ移動・自動リロード） |
| [folder-tree.md](folder-tree.md) | フォルダツリーダイアログ |
| [lightbox.md](lightbox.md) | Lightbox・メタデータビュー |
| [settings.md](settings.md) | 設定ダイアログ・設定の永続化 |
| [auth.md](auth.md) | 認証ダイアログ・起動フロー（サーバー側は [backend/auth.md](../backend/auth.md)） |

## 2. 背景・目的

現行コード（`frontend/`、Simple Eagle の無改変移植）は Eagle Web API v1 前提の構造的問題を抱える：

| 問題 | 原因（コード調査で特定済み） |
| --- | --- |
| フォルダを開くと 11 件しか表示されない | `currentPageCount` を戻す action が無く、フォルダ切替でページ番号が累積したまま次ページを取得する。仮想スクロールの初期実測も不安定 |
| 下スクロール後に上端へ戻ると 1 列目が消える | DOM 仮想化の offset 計算（旧指示書 `old/21_scroll4.md` の「スクロール座標の振動」と同根） |
| フィルタの絞り込み漏れ | フィルタが**ロード済みアイテムへのクライアント側絞り込みのみ**。サーバー側フィルタは未接続 |
| フィルタ中に Lightbox を操作するとフィルタが解除される | Lightbox のみルート制御で、遷移時に `filter` ルートの query を失う |

バックエンドが自前実装（`backend/base.md`）になった今、Simple Eagle との API 互換に縛られる理由が
なくなった。**フィルタをすべてサーバー側に寄せ、必要な API 拡張を行う**前提で設計し直す。

## 3. 関連ドキュメント

- モックアップ: [.claude/design/Mobile Eagle.dc.html](../../design/Mobile%20Eagle.dc.html) /
  [.claude/design/claudeDesign指示.md](../../design/claudeDesign指示.md)（デザインの一次情報）
- 要件: [.claude/INSTRUCTION.md](../../INSTRUCTION.md)
- 旧指示書（実装意図の参考）: `.claude/specs/frontend/old/`
- 改造版（実装方式の取り込み元）: `~/work/AI/Eagle関連/simple-eagle-kairin`
- バックエンド仕様: [.claude/specs/backend/base.md](../backend/base.md)
- コーディング規約: [.claude/specs/coding.md](../coding.md)
- Eagle API の実挙動: [.claude/specs/plugin-test.md](../plugin-test.md)

## 4. 技術スタック・プロジェクト構成

Vue 3（Composition API + `<script setup>`）+ TypeScript + Vite + Pinia + Vue Router + Tailwind CSS。
追加の実行時依存は増やさない（i18n は自前実装。6 章）。

```
frontend/
  index.html            … title「Mobile Eagle」
  vite.config.ts        … outDir: ../plugin/public（emptyOutDir: true）/ dev プロキシ（/api → localhost:8000）
  tailwind.config.js    … darkMode: 'class' / CSS 変数を色に割り当て
  src/
    main.ts             … createApp + Pinia + Router
    App.vue             … ヘッダー・グリッド・各ダイアログのマウント
    router.ts
    env.ts              … 定数（ITEM_GET_COUNT = 600 など）
    types.ts            … TImageItem / TFolderItem / TFilter / TSettings
    api/
      eagle-api.ts      … API クライアント（fetch ラッパー。9 章）
    stores/             … Pinia setup store（8 章）
      items.ts / folders.ts / selection.ts / ui.ts
    composables/
      use-settings.ts   … 設定の永続化（settings.md）
      use-theme.ts      … テーマ適用（5 章）
      use-i18n.ts       … 多言語（6 章）
      use-auto-reload.ts … 自動リロード（grid.md）
    locales/
      ja.ts / en.ts
    components/
      common/           … ダイアログ枠・チップボタン・星・トーストなど共通部品
      header/  grid/  filter/  action/  folder-tree/  lightbox/  settings/
    css/
      main.css          … Tailwind エントリ + テーマ CSS 変数
```

- ファイル名は kebab-case、Vue コンポーネントのみ PascalCase（coding.md）
- **旧ソースの扱い（ユーザー決定 2026-07-18）**: 現行の移植版は削除せず `frontend-old/` へ
  リネームして参考用に保持する（ビルド対象外）。新実装を `frontend/` に作る
- **開発**: `yarn dev --host`（Vite dev サーバー、`0.0.0.0` バインド）。`/api` を
  `http://localhost:8000`（プラグインのサーバー）へプロキシする（**`xfwd: true` を設定**し
  `X-Forwarded-For` を付与する。スマホからの `:5173` アクセスに実機同様の認証を要求するため。
  backend/auth.md 4 章）。プロキシ経由なので CORS 対応は
  不要（backend/base.md がスコープ外にしていた課題の解決策）。
  スマホからは `http://{PCのIP}:5173` でアクセスできるため、**開発中は `plugin/public/` の
  旧アプリ（`:8000`）を壊さず、新旧を並行比較できる**（バグ切り分けに使う）
- **ビルド**: `yarn build` で `plugin/public/` に直接出力する（`emptyOutDir` で旧成果物を消す）。
  ただし**実行するのは最終マイルストーンのみ**（14 章）。それまで `plugin/public/` は旧アプリの配信を続ける

## 5. デザインシステム

### 5.1 テーマ（CSS 変数 + `.dark` クラス）

モックアップの変数セットをそのまま採用する。`css/main.css` の `:root` にライト値、
`:root.dark` にダーク値を定義する。

| 変数 | ライト | ダーク |
| --- | --- | --- |
| `--bg` | `#ffffff` | `#232729` |
| `--fg` | `#1a1a1a` | `#ffffff` |
| `--panel` | `#ffffff` | `#2a2f31` |
| `--elev` | `#f4f5f5` | `#33383b` |
| `--border` | `rgba(0,0,0,.10)` | `rgba(255,255,255,.13)` |
| `--muted` | `#6b7075` | `#9aa1a5` |
| `--hover` | `rgba(0,0,0,.05)` | `rgba(255,255,255,.07)` |
| `--thumb` | `#eceded` | `#1b1e20` |
| `--accent` | `#2f6fed` | `#2f6fed` |
| `--scrim` | `rgba(0,0,0,.42)` | `rgba(0,0,0,.55)` |

- テーマ設定は `'light'`（規定）/ `'dark'` / `'auto'` の 3 値（settings.md）
- `use-theme.ts` が `<html>` に `.dark` を付与/除去し、`document.documentElement.style.colorScheme` も設定する
- `'auto'` は `matchMedia('(prefers-color-scheme: dark)')` に従い、`change` イベントを監視する
  （リスナーは auto 選択時のみ反応）
- Tailwind は `theme.extend.colors` で CSS 変数を割り当てる（例: `bg: 'var(--bg)'` → `bg-bg`）。
  **`dark:` バリアントは原則使わない**（色は CSS 変数側で切り替わるため。クラスの二重管理を避ける）

### 5.2 UI 共通規約（モックアップ指示書より）

- ボタンは角丸。ホバーは `--hover`
- **チェックボックス / ラジオは標準アイコンを表示しない**。チップ型ボタンで表現し、
  選択中は `--accent` 背景 + 白文字 + チェックアイコン（`components/common/` に共通化）
- テキスト入力は **`font-size: 16px` 以上**（iPhone のフォーカスズーム対策）。高さ 44px、背景 `--elev`
- 設定・フィルタの項目は「見出し / 内容」の**縦並び**（横並びにしない）
- タップ領域は原則 44px 以上（coding.md）。ただし**モックアップの実寸が優先**
  （ヘッダーボタン 40px・コントローラー 38px 等。最小でも 34px を下回らず、隣接要素と間隔を取る）
- 操作ボタン（特に連打するもの）には `touch-action: manipulation` を指定し、
  ダブルタップズームを抑止する（グリッドサイズボタン連打でズームする既知問題への対策）
- ダイアログの縦位置は **`align-items: flex-start`（上寄せ）**
- グリッドは**ブラウザ幅 100% を使う**。コンテンツの max-width 指定はしない
- z-index の階層: ヘッダー 20 / グリッドコントローラー 30 / アクションビュー 40 /
  各ダイアログ 60 / 移動先選択ダイアログ 70 / Lightbox 80（メタデータビュー 86）/ 認証ダイアログ 95

### 5.3 フォント・アイコン

- フォントはシステムフォントスタック（`"Helvetica Neue", Arial, "Hiragino Sans", "Noto Sans JP", sans-serif` 系）。
  **Google Fonts 等の外部リソースは参照しない**（VPN/LAN 内で完結させる。モックアップの
  Noto Sans JP / Material Symbols への参照は置き換える）
- アイコンは**インライン SVG**（`components/common/icons/` に部品化）。アイコンフォントは使わない

## 6. 多言語対応（i18n）

- **自前の軽量実装**とする（UI 文言は数十件の静的ラベルのみで、vue-i18n を入れるほどではない）
- `locales/ja.ts` / `locales/en.ts` に全 UI 文言を定義し、`useI18n().t('key')` で参照する。
  キーが無い場合は ja にフォールバック
- 言語は **`navigator.language` から自動決定**する（`ja` で始まれば日本語、それ以外は英語）。
  手動切り替え UI は設けない（INSTRUCTION.md）
- 日付フォーマット `yyyy/MM/dd hh:mm:ss` は言語共通

## 7. ルーティング

**URL を唯一の情報源にする**（旧実装の「ルートと store の二重管理」を解消する）。

| path | 内容 |
| --- | --- |
| `/` | `/folder/all` へ redirect |
| `/folder/:folderId` | 唯一の画面（グリッドビュー） |

- `folderId` は実フォルダ ID のほか、仮想フォルダ `all`（すべて）/ `uncategorized`（未分類）を取る
- **フィルタ条件は query** で持つ: `stars` / `exts` / `tags`（カンマ区切り）、`keyword`
- **Lightbox は query `image={itemId}`** で開閉する。ブラウザバックで閉じられ、
  フィルタ query がそのまま維持されるため、旧実装の「フィルタ文脈の喪失」が構造的に起きない
- フォルダツリー / フィルタ / 設定の各ダイアログはルーティングしない（`ui` store のフラグで開閉）
- ルート（path + query）の変化を watch して一覧の再取得・Lightbox の開閉を行う。
  ブラウザの戻る / 進むでも状態が正しく復元される。
  **ただし `image` query の変化は一覧の再取得・スクロールリセットの対象にしない**
  （Lightbox の開閉・前後移動のたびに一覧がリセットされる事故を防ぐ。grid.md 3.4）

## 8. 状態管理（Pinia setup store）

| store | 持つもの | 主な操作 |
| --- | --- | --- |
| `items` | `items[]` / `pageCount` / `hasMore` / `isLoading` / `isReloading` | `loadFirstPage(ctx)`（リセットして 1 ページ目）/ `loadNextPage()` / `reloadAll()`（自動リロード用）/ `patchItem()` / `removeItems()` |
| `folders` | `folders[]`（ツリー）/ `extList[]` / `uncategorizedCount` / `totalCount` / `isLoaded` | `load()` / 合算件数の getter |
| `selection` | `isSelectMode` / `selectedIds: Set` / `actionMode` / `rangeAnchorId` / `moveTargetId` | 選択トグル・範囲選択・全解除 |
| `ui` | `isTreeOpen` / `isFilterOpen` / `isSettingsOpen` / `isMoveOpen` | 開閉 |
| `auth` | `status: 'checking' \| 'required' \| 'ok' \| 'error'` | 起動時チェック・ログイン（auth.md） |

設計上の決定：

- **現在フォルダ・フィルタ条件・Lightbox の表示対象は store に持たない**。route（7 章）から
  computed で導出する
- **選択状態を item オブジェクトに持たせない**（旧 `TImageItem.select` の廃止）。
  `selectedIds: Set<string>` で管理する
- `loadFirstPage()` は `items` クリア・`pageCount = 0`・`hasMore = true` を**必ずセットで行う**
  （旧バグの根本原因だったリセット漏れを構造的に防ぐ）
- 設定（テーマ・自動更新・画質・グリッド列数など）は store ではなく `use-settings.ts` が持つ
  （settings.md。シングルトンにする — 旧実装でインスタンス多重生成の不具合実績あり）

## 9. API クライアント

`api/eagle-api.ts` に薄い fetch ラッパーを実装する。ベースパスは `/api/eagle`（同一オリジン）。

| メソッド | エンドポイント | パラメータ | 備考 |
| --- | --- | --- | --- |
| `fetchItems` | GET `/list` | `limit`(600) / `offset` / `folders` / `keyword` / `ext`（カンマ区切り可・拡張） / `tags` / `stars`（拡張） | `folders` は `all` のとき付けない |
| `fetchFolders` | GET `/folders` | なし | 拡張レスポンス（10 章）を受ける |
| — | GET `/get_thumbnail_image?id=` | | URL 組み立てのみ（`<img src>` 用） |
| — | GET `/get_image?id=&max_file_size=&quality=` | | 同上。設定値を付与 |
| `updateItem` | POST `/update` | `{ id, star?, tags?, annotation?, url? }` | |
| `moveToTrash` | POST `/move_to_trash` | `{ itemIds: string[] }` | |
| `moveToFolder` | POST `/move_to_folder` | `{ itemIds: string[], folderId: string }` | 拡張（10 章） |
| `checkAuth` / `login` | GET `/api/auth/check` / POST `/api/auth/login` | | [auth.md](auth.md) 参照（ベースパス外） |

重要な取り決め：

- **`offset` はページ番号**（スキップ件数 = `offset × limit`）。これは Mobile Eagle バックエンドの
  仕様（backend/base.md 6.1）。改造版（kairin）はアイテム件数ベースに変更していたが、
  **本プロジェクトではバックエンドに合わせてページ番号のまま使う**。混同しないこと
- 終端判定は「返却件数 < limit なら `hasMore = false`」。以後の追加リクエストを抑止する（kairin 方式）
- **フィルタ（stars / exts / keyword / tags）はすべてサーバー側で行う**。
  クライアント側の絞り込みは行わない（絞り込み漏れと終端判定の破壊を防ぐ）
- 並び順はバックエンド既定の `importedAt` 降順に従う（`orderBy` は当面使わない）
- エラー処理: `response.ok` と `data.status` の両方を確認し、失敗は throw。
  呼び出し側は**楽観的更新 + 失敗時ロールバック**を基本パターンにする
  （即時反映 → API → 失敗したら元に戻してトースト表示）
- エラー通知は `components/common/Toast.vue`（数秒で消える簡易トースト）。
  破壊的操作の事前確認のみ `window.confirm` を使う（モックアップ指示）
- **401 は共通処理**: 認証ダイアログの再表示につなげる（auth.md 5 章）

## 10. バックエンド拡張（この仕様で `plugin/js/` に追加する）

フロント書き直しに合わせて、バックエンドに以下を追加する。いずれも既存動作を壊さない追加拡張。

1. **`GET /list` に `stars` パラメータを追加**
   - カンマ区切りの整数（0〜5）。例: `stars=0,3,5`
   - item の `star`（未設定は 0）がいずれかに一致するものだけ返す
   - `eagle.item.get()` に該当機能は無いため、JS 側フィルタ（既存の limit/offset 処理と同じ層）で実装
2. **`GET /list` の `ext` をカンマ区切りの複数値に対応させる**
   - フィルタ UI が拡張子の複数選択（grid.md 4 章）のため。例: `ext=jpg,png`
   - **`eagle.item.get()` の `ext` には渡さず**、`stars` と同じ JS 側フィルタで実装する
     （検証済みなのは単一値の挙動のみ。`keyword` が黙って無視された前例があるため、
     未検証の複数値指定はプラグイン API に渡さない）
3. **`GET /list` の `folders=uncategorized` を特別扱い**
   - `folders` 配列が空のアイテムのみ返す（改造版の方式。プラグイン API に「未分類」の概念が無いため）
   - keyword / ext / tags / stars / ページングは通常のフォルダ指定と同様に適用する
4. **`POST /move_to_folder` エンドポイントを追加**（フォルダ移動）
   - リクエスト: `{ "itemIds": string[], "folderId": string }`
     （`folderId` は実フォルダ ID、または特殊値 **`uncategorized`**）
   - `folderId` が実フォルダ ID の場合は**実在を先に確認**する（`eagle.folder` で見つからなければ
     404。不正 ID で `save()` するとアイテムがどのフォルダにも表示されなくなるため）
   - 各 item の `folders` を **`[folderId]` に置き換えて** `item.save()`
     （`item.folders` 書き換え + `save()` は実機検証済み。概要.md）
   - **`folderId` が `uncategorized` の場合は `folders` を空配列 `[]` にする**
     （全フォルダから外す = 未分類へ移動）
   - **複数フォルダに属するアイテムは全所属が移動先 1 つに置き換わる**（「移動」の定義。
     追加ではなく置換）
   - 成功 `{ "status": "success" }` / 失敗 `{ "status": "error", "message": "..." }`
     （`move_to_trash` と同じパターン）。順次処理のため**途中失敗時は一部だけ移動済みに
     なり得る**（`move_to_trash` と同じ割り切り。フロント側の再同期は grid.md 5.5）
5. **`GET /folders` のレスポンス拡張**
   - `{ "status": "success", "data": [...], "extList": ["jpg", "png", ...], "uncategorizedCount": 123, "totalCount": 45678 }`
   - `extList` はライブラリ内の拡張子の重複なしリスト（小文字）。フィルタ UI の候補に使う
     （旧実装は「ロード済み画像から集計」でスクロール量に依存して候補が変わる不安定さがあった）
   - `uncategorizedCount` は `folders` が空のアイテム数。フォルダツリーの「未分類」の件数表示に使う
   - `totalCount` は全アイテム数。フォルダツリーの「すべて」の件数表示に使う
     （フォルダ件数の合算では複数フォルダ所属のアイテムが二重計上され、正確な全件数にならないため）
   - `/folders` は imageCount 集計のためにすでに全件走査しているので、追加コストはほぼゼロ

改造版が入れていた「フォルダ指定時の他フォルダ画像混入」へのクライアント側防御フィルタは
**入れない**。Mobile Eagle バックエンドは `eagle.item.get({folders})` の絞り込みを実機検証済み
（backend/base.md 13 章）であり、クライアント側で間引くと「返却件数 < limit」の終端判定が壊れるため。
万一混入が再現したらバックエンドの不具合として直す。

## 11. グリッドの描画方式（DOM 仮想化はしない）

旧実装の DOM 仮想化はスクロール座標のフィードバックループ（振動・上端欠け）の温床だった
（`old/21_scroll4.md` に苦闘の記録）。本設計では **JS による仮想化を廃止**する。

- ロード済みアイテムはすべて DOM に置く
- 各セルに `content-visibility: auto` + `contain-intrinsic-size`（セル寸法）を指定し、
  画面外セルのレンダリングコストをブラウザに任せて回避する
- サムネイルは `loading="lazy"`
- スクロールコンテナは `<main>` の**内部スクロール**（window スクロールは使わない。
  実測ベースの位置計算を不要にする）
- 数千件ロード後の性能が実測で問題になった場合のみ、仮想化を再検討する（オープン課題）

## 12. エッジケース（共通）

| ケース | 挙動 |
| --- | --- |
| 一覧が 0 件 | 「表示する画像がありません」を中央表示 |
| 一覧取得の失敗 | トースト表示。`hasMore` は維持し、再スクロールで再試行できる |
| 更新系 API の失敗 | ロールバック + トースト |
| 不正な `folderId` の URL | 0 件表示（バックエンドが空配列を返す） |
| query の `image=` がロード済みに無い（ディープリンク） | **初回ページのロード完了後に判定**し、無ければ Lightbox を開かず query を除去（ロード前に判定すると 1 ページ目のアイテムまで除去してしまう）。オープン課題: 単品取得 API |
| 戻る / 進む | route watch で一覧・フィルタ・Lightbox が復元される |

## 13. スコープ外

- **スマートフォルダ対応**（プラグイン API に smart-folder API が存在する:
  https://developer.eagle.cool/plugin-api/ja-jp/api/smart-folder 。
  実装は後回しとユーザーが決定（2026-07-17）。要件定義のうえ別仕様）
- 動画対応
- ステータスウィンドウ UI（プラグイン側の別仕様）

## 14. 実装マイルストーン（全仕様の実装順）

各仕様書のステップ・コミットポイントを以下の順で消化する。

| 順 | 仕様書 | 内容 |
| --- | --- | --- |
| 1 | base.md（本書） | スキャフォールド → デザインシステム・i18n → API クライアント・store・バックエンド拡張 |
| 2 | auth.md + backend/auth.md | 認証（起動フローと 401 処理が基盤に食い込むため先に実装する） |
| 3 | grid.md | グリッドビュー本体（ヘッダー・パンくず・グリッド・無限スクロール・コントローラー） |
| 4 | folder-tree.md | フォルダツリー（未分類含む） |
| 5 | grid.md（続き） | フィルタ → 複数選択・アクションビュー（フォルダ移動含む） → 自動リロード |
| 6 | lightbox.md | Lightbox・メタデータビュー |
| 7 | settings.md | 設定ダイアログ（テーマ UI 含む） |
| 8 | base.md（本書） | 本ビルド切り替え（`plugin/public/` を新アプリへ置き換え） |

### base.md 自体の実装ステップ

- [x] 1. 現行の移植版（`frontend/` と `plugin/public/`、いずれも未コミット）をコミットし、
  `frontend/` を `frontend-old/` へリネームする。新規スキャフォールドを `frontend/` に作る
  （Vite / TS / Tailwind / Pinia / Router / ESLint 最小構成。`yarn dev --host` でタイトル
  「Mobile Eagle」のシェル（ヘッダーのみの画面）が表示される）
- [x] 2. デザインシステムを実装する（テーマ CSS 変数・`use-theme.ts`・**`use-settings.ts` の骨格**
  （テーマ設定の読み書きに必要。settings.md 4 章のスキーマで実装）・共通コンポーネント:
  ダイアログ枠 / チップボタン / 星 / トースト / アイコン）と i18n 基盤（`use-i18n.ts` + ja/en）

> 📌 **コミットポイント base-1** — 新シェルがスマホで表示される（Vite dev サーバー `:5173` 経由。
> テーマを一時ボタンでライト/ダーク切替でき、再読込後も保持される）。旧アプリ（`:8000`）は
> 引き続き動いている
> → ユーザーがチェック → `/step-commit` でコミット

- [ ] 3. バックエンド拡張（10 章の 4 点）を実装する
- [ ] 4. API クライアント（`eagle-api.ts`）と store 群（8 章）を実装する

> 📌 **コミットポイント base-2** — curl で `stars` / `ext`（複数）/ `folders=uncategorized` /
> `/folders` の `extList`・`uncategorizedCount`・`totalCount` が確認できる
> → ユーザーがチェック → `/step-commit` でコミット

### 最終ステップ（全仕様の完了後）

- [ ] 5. `yarn build` で `plugin/public/` を新アプリに置き換え、プラグイン配信（`:8000`）で
  全機能をスマホから確認する
- [ ] 6. `frontend-old/` を削除するかユーザーに確認する（保持のままでもよい）

> 📌 **コミットポイント base-3** — プラグイン配信が新アプリに切り替わり、Vite dev サーバー
> なしで全機能が動作する
> → ユーザーがチェック → `/step-commit` でコミット

## 15. オープン課題

- [ ] **スマートフォルダ**: プラグイン API に smart-folder API が存在する（公式ドキュメント確認済み）。
  実装は後回しとユーザーが決定（2026-07-17）。着手時は実挙動の検証（plugin-test.md 方式）から始める
- [ ] **自動リロードのポーリング負荷**: `/list?limit=1` でも毎回全件走査になる
  （backend/base.md の未解決課題「/list の性能」と同根）。体感で問題が出たら
  バックエンドの短時間メモリキャッシュを検討
- [ ] **単品取得 API が無い**: Lightbox へのディープリンク（未ロードの `image=` query）を
  開けない。必要になったら `GET /api/eagle/item?id=` を追加する
- [ ] **imageCount の二重計上**（backend/base.md から引き継ぎ）: 親子フォルダの両方に属する画像を
  親の合算で二重に数える。Simple Eagle 以来の挙動なので当面そのまま
- [ ] **仮想化の再導入判断**: `content-visibility` 方式で性能不足が実測されたら検討
