# Mobile Eagle

画像管理アプリ **Eagle** をスマートフォンに最適化した UI で閲覧するための **Eagle プラグイン**。

プラグイン内に HTTP サーバーを常駐させ、スマホのブラウザから VPN（Tailscale）経由でアクセスする。
CLI アプリだった前身「Simple Eagle」を、導入の敷居を下げるためプラグイン方式へ移植したもの。

## ドキュメント

このファイルは目次。詳細は各ドキュメントを参照する。

| ドキュメント | 内容 |
| --- | --- |
| [.claude/概要.md](.claude/概要.md) | **全体方針・設計判断・検証結果の要点**。まずここを読む |
| [.claude/specs/coding.md](.claude/specs/coding.md) | コーディング規約 |
| [.claude/specs/plugin-test.md](.claude/specs/plugin-test.md) | **Eagle Plugin API の実挙動**（実機検証済み） |
| [.claude/knowledge.md](.claude/knowledge.md) | 実装で詰まったこと・新しく発見した知見 |
| [.claude/INSTRUCTION.md](.claude/INSTRUCTION.md) | ユーザーからの都度の指示 |

## 重要な原則

- **Eagle Plugin API は公式ドキュメントと実挙動が食い違う。**
  設計・実装の根拠は必ず [.claude/specs/plugin-test.md](.claude/specs/plugin-test.md) の検証結果に置く。
  公式ドキュメントの記述だけを根拠にしない
- **知見は [.claude/knowledge.md](.claude/knowledge.md) に書く。**
  実装で詰まったこと、公式ドキュメントと違った挙動、回避策とその理由を残す
- **大きな機能は仕様書を起こしてから実装する**（`/create-spec`）
- いきなり実装を開始しない。実装してよいかユーザーに確認する
- 不明な点は勝手に推測せず、必ずユーザーに確認する

## 技術スタック

- **プラグイン側**：素の JavaScript（Eagle 内 = Chromium 107 + Node.js 16）
- **フロントエンド側**：Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS
- **配布**：`.eagleplugin`（フロントエンドを同梱）

プラグイン側とフロントエンド側で**実行環境が異なる**（Node.js が使えるかどうか）。
詳細は [coding.md の「4. 実行環境の区別」](.claude/specs/coding.md)。

## スキル・エージェント

| 名前 | 用途 |
| --- | --- |
| `/create-spec` | 大きな機能の実装前に仕様書を起こす |
| `/step-commit` | コミットポイントで knowledge 更新とコミットを行う |
| `spec-reviewer` | 仕様書の整合性をレビューする（read-only） |

## 参考

- 移植元 Simple Eagle：`/Volumes/D/works/simple-eagle`
- Eagle Plugin API：https://developer.eagle.cool/plugin-api/ja-jp
