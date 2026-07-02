# 0002. mise をタスクランナーとツール管理の単一入口にする

## 状態

採用

## 背景

このプロジェクトでは、iPhone アプリ、Mac 側ブリッジ、tmux 連携、各種テストなど、複数の実行対象が発生する。

個別に `pnpm`、`biome`、`expo`、テストランナーを直接実行すると、git worktree 運用や環境差分でコマンドが散らばりやすい。

## 判断

開発ツールは mise で管理し、開発コマンドは mise tasks に集約する。

可能な限り `pnpm`、`biome`、`expo`、テストランナーなどを直接実行せず、`mise run ...` を入口にする。

## 理由

- git worktree 運用時に、各 worktree で同じコマンド体系を使いやすい。
- ツールのバージョンと実行コマンドを `mise.toml` に集約できる。
- AI エージェントが実行すべきコマンドを判断しやすい。
- CI とローカル検証の入口を揃えやすい。

## 影響

- 新しい開発コマンドを追加する場合は、先に `mise.toml` に task として定義する。
- `package.json` の scripts は、必要な場合でも mise task から呼ばれる内部実装として扱う。
- ドキュメントには、原則として `mise run ...` の形でコマンドを記載する。

## 未解決事項

- pnpm、Biome、テストランナーの具体バージョン。
- Unit Test、Component Test、Integration Test、E2E Test に使う具体的なツール。
- CI でどの mise task を必須にするか。

