# Development Setup

このドキュメントには、ローカル開発環境の準備手順を記録する。

## 前提条件

| ツール | バージョン | 用途 | インストール方法 |
| --- | --- | --- | --- |
| mise | TBD | ツールバージョン管理とタスクランナー | TBD |
| Node.js | 24 | JavaScript または TypeScript の実行基盤 | `mise install` |
| pnpm | TBD | Node.js 依存関係の管理 | `mise install` |
| Biome | TBD | Lint と Format | `mise install` |

## 初回セットアップ

```sh
mise install
mise run install
```

Expo プロジェクトの初期化後に、`mise run install` の実体を `mise.toml` に定義する。

## 環境変数

必要な環境変数を記載する。秘密情報の値は記載しない。

| 変数名 | 必須 | 用途 | 例 |
| --- | --- | --- | --- |
| TBD | TBD | TBD | TBD |

## ローカル起動

```sh
mise run dev
```

## トラブルシュート

よくある問題と解決方法を記載する。

| 症状 | 原因 | 対応 |
| --- | --- | --- |
| TBD | TBD | TBD |
