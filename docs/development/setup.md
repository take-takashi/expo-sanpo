# Development Setup

このドキュメントには、ローカル開発環境の準備手順を記録する。

## 前提条件

| ツール | バージョン | 用途 | インストール方法 |
| --- | --- | --- | --- |
| mise | 2026.6.14 で検証 | ツールバージョン管理とタスクランナー | 公式手順で事前に導入する |
| Node.js | 24 | JavaScript または TypeScript の実行基盤 | `mise install` |
| pnpm | 11.9.0 | Node.js 依存関係の管理 | `mise install` |
| Biome | 2.5.2 | Lint と Format | `mise install` |

## 初回セットアップ

```sh
mise install
mise run install
```

`mise run install` は pnpm workspace 全体の依存関係をインストールする。

pnpm 11 の build script 承認では、現時点で `esbuild` を許可している。この承認は
`pnpm-workspace.yaml` の `allowBuilds` に記録する。

## 環境変数

必要な環境変数を記載する。秘密情報の値は記載しない。

| 変数名 | 必須 | 用途 | 例 |
| --- | --- | --- | --- |
| `EXPO_SANPO_PROMPT_DRIVER` | 任意 | prompt 実行方式を切り替える | `tmux` |
| `EXPO_SANPO_TMUX_SESSION_PREFIX` | 任意 | tmux セッション名の prefix | `expo-sanpo` |

## ローカル起動

```sh
mise run dev
```

Mac 側ブリッジだけを起動する場合は、次のコマンドを使う。

```sh
mise run dev:bridge
```

ブリッジ起動時には、`http://localhost:8787` と Mac のネットワーク IP アドレスを使った URL を表示する。iPhone 実機の Expo Go から接続する場合は、表示された IP アドレス付き URL をアプリの Bridge URL に入力する。

通常の prompt 送信は mock 応答を返す。tmux との接続だけを検証する場合は、次のように起動する。

```sh
EXPO_SANPO_PROMPT_DRIVER=tmux mise run dev:bridge
```

この段階では Codex CLI は起動せず、tmux 上の `cat` セッションへ入力して capture した内容を返す。

## トラブルシュート

よくある問題と解決方法を記載する。

| 症状 | 原因 | 対応 |
| --- | --- | --- |
| `pnpm install` が `ERR_PNPM_IGNORED_BUILDS` で失敗する | pnpm 11 の build script 承認が未反映である | `pnpm-workspace.yaml` の `onlyBuiltDependencies` を確認し、必要な依存だけを承認する |
