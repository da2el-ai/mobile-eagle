# パスワード認証（バックエンド） 仕様書

## 1. 概要

`/api/eagle/*` をパスワード認証で保護する。backend/base.md 6 章で用意した
**全リクエストが通る前段フック**に差し込む形で実装する。
フロントエンドの認証ダイアログは [frontend/auth.md](../frontend/auth.md)。

## 2. 背景・方針

- VPN（Tailscale）前提の個人用ツールだが、プラグインとして配布する以上は必須級の機能（概要.md）
- Eagle 本体の Web API の方針「**localhost は認証免除・リモートは必須**」を踏襲する
- パスワードは平文で plugin 側 localStorage に保存（概要.md で許容済み）。
  設定は**ステータスウィンドウのパスワード入力欄**から行う（status-window.md。実装済み）。
  当初は「UI 実装前は devtools で localStorage を直接編集する」運用だったが、
  UI が入ったため不要になった（`manifest.json` の `devTools` は false に戻した）
- **開発中の運用**: パスワードを設定すると、401 ハンドリングを持たない旧アプリ（`:8000` の
  `plugin/public/`）はスマホから使えなくなる。**認証の動作確認時のみパスワードを設定し、
  普段の並行開発では空にしておく**（frontend/base.md 4 章の新旧並行比較を維持するため）

## 3. 関連ドキュメント

- [backend/base.md](base.md)（6 章: 前段フックの挿入点 / 8.3: `mobile-eagle-settings` の `password`）
- [frontend/auth.md](../frontend/auth.md)（認証ダイアログ・起動フロー）
- [.claude/概要.md](../../概要.md)（認証方針・パスワード要件: 英数記号 0〜128 文字）
- 参考実装: `~/work/AI/Eagle関連/simple-eagle-kairin`（Cookie 方式・localhost 免除）

## 4. 認証方式

- パスワード: plugin localStorage `mobile-eagle-settings` の `password`。**空文字なら認証無効**
- 認証トークン: **`SHA-256(password + 固定ソルト "mobile-eagle-auth-v1")` の hex**（決定的トークン）
  - kairin 版は「起動毎ランダムトークン」だったが、それだと **Eagle を再起動するたびに
    全端末で再ログイン**が必要になる。決定的トークンなら再起動をまたいで Cookie が有効で、
    パスワード変更時には全端末が自動的に無効化される
  - トークンはパスワード等価の秘密情報。**ログ・QR・レスポンスボディに出さない**
- Cookie: `me_auth={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`（30 日）
- **localhost からのリクエストは認証免除**（Eagle Web API と同方針）。判定は次の 2 条件の AND:
  1. `remoteAddress` が `127.0.0.1`（サーバーは `0.0.0.0`（IPv4）バインドのため実質これのみ。
     `::1` / `::ffff:127.0.0.1` 形式の考慮は不要）
  2. `X-Forwarded-For` ヘッダーが**無い**、または値がすべて localhost
  - `X-Forwarded-For` は**免除を打ち消す方向にのみ**使う（免除を与える根拠には決して使わない）。
    リモートから XFF を偽装しても条件 1 を満たせないため、免除は得られない
  - 目的: Vite dev プロキシ（`xfwd: true` を設定。frontend/base.md 4 章）経由のアクセスで、
    **スマホからの開発アクセス（`:5173`）には実機同様に認証を要求**しつつ、
    開発マシン自身からのアクセスは免除するため

## 5. エンドポイント・保護範囲

### 5.1 `GET /api/auth/check`（認証不要）

レスポンス: `{ "status": "success", "authRequired": bool, "authenticated": bool }`

- `authRequired`: パスワードが設定されているか（localhost からは常に false）
- `authenticated`: 有効な Cookie を持っているか

### 5.2 `POST /api/auth/login`（認証不要）

リクエスト: `{ "password": "..." }`

- 一致: `Set-Cookie` を付けて `{ "status": "success" }`
- 不一致: HTTP 401 で `{ "status": "error", "message": "パスワードが間違っています" }`
- 比較はタイミングセーフに行う（`crypto.timingSafeEqual`。長さ不一致は先に弾く）

### 5.3 保護範囲

| パス | 認証 |
| --- | --- |
| `/api/eagle/*` | **必要**（未認証は 401 `{ "status": "error", "message": "認証が必要です" }`） |
| `/api/auth/*` / `/api/ping` | 不要 |
| 静的配信（SPA 本体） | 不要（認証ダイアログを描画するのが SPA 自身のため。`public/` に秘密情報を置かない規約が前提） |

## 6. 実装

- `plugin/js/auth.js`（`ME.auth`）を新設し、`server.js` の前段フック挿入点から呼ぶ
- Cookie ヘッダーは自前でパースする（依存パッケージを増やさない）
- パスワードは `ME.settings` 経由で読む（リクエストごとに読んでよい。設定変更が即反映される）
- 認証失敗・未認証アクセスは軽微エラーとしてログに記録する（coding.md 9 章）

## 7. エッジケース

| ケース | 挙動 |
| --- | --- |
| パスワード未設定（空） | 認証無効。`check` は `authRequired: false`。フックは素通し |
| パスワード変更 | トークンが変わるため既存 Cookie は自動的に全無効化。各端末は再ログイン |
| パスワード設定→空に変更 | 認証無効に戻る。既存 Cookie は無視される（素通しのため） |
| Cookie 改ざん・期限切れ | 401 → フロントがダイアログを再表示（frontend/auth.md） |
| 連続ログイン失敗 | レート制限はしない（VPN 前提。オープン課題に記載） |

## 8. セキュリティ上の割り切り

- 平文パスワード保存・HTTP（非 TLS）通信は VPN 前提で許容（概要.md の方針）
- トークンが漏れた場合はパスワード変更で無効化する運用

## 9. 実装ステップ

前提: frontend/base.md のコミットポイント base-2（API クライアント）まで完了。
frontend/auth.md と同じマイルストーンで実装する。

- [x] 1. `auth.js`（トークン生成・Cookie 検証・localhost 判定）と前段フックへの結線
- [x] 2. `/api/auth/check` / `/api/auth/login` の実装

> 📌 コミットポイントは frontend/auth.md 側（auth-1）に統合する（フロントのダイアログと
> 合わせて動作確認するため）。curl での単体確認: パスワード設定時に Cookie 無しの
> `/api/eagle/list` が 401 / login で Cookie を得ると 200 / localhost は常に 200

## 10. オープン課題

- [ ] ログイン失敗のレート制限（VPN 前提で当面なし）
- [x] パスワード設定 UI はステータスウィンドウ仕様（別途）。それまで devtools で設定する
  → ステータスウィンドウに実装済み。devtools 経由の運用は終了（2026-07-30）
