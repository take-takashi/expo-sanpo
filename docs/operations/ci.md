# CI

## 方針

GitHub Actions で `mise run check` を必須検証にする。

CI でもローカルと同じく、直接 `pnpm`、`biome`、`jest`、`maestro` などを呼ばず、mise tasks を入口にする。

## 初期ジョブ

| ジョブ | コマンド | 必須 | 備考 |
| --- | --- | --- | --- |
| check | `mise run install` → `mise run check` | 必須 | Lint、Format 確認、型チェック、Unit、Component、Integration Test、E2E Test の入口を含める |
| e2e | `mise run test:e2e` | TBD | Maestro の実行環境が固まってから必須化を判断する |

## 実装

GitHub Actions の `.github/workflows/check.yml` で、次の順に実行する。

1. `actions/checkout@v6` でリポジトリを取得する。
2. `jdx/mise-action@v4` で mise と `mise.toml` のツールをセットアップする。
3. `mise run install` で pnpm workspace の依存関係をインストールする。
4. `mise run check` でローカルと同じ総合検証を実行する。

## 未解決事項

- E2E Test を GitHub Actions で実行するか、EAS Workflows で実行するか。
- tmux 実プロセスを使う Integration Test を CI で実行するか。

