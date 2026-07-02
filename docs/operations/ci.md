# CI

## 方針

GitHub Actions で `mise run check` を必須検証にする。

CI でもローカルと同じく、直接 `pnpm`、`biome`、`jest`、`maestro` などを呼ばず、mise tasks を入口にする。

## 初期ジョブ案

| ジョブ | コマンド | 必須 | 備考 |
| --- | --- | --- | --- |
| check | `mise run check` | 必須 | Lint、Format 確認、型チェック、Unit、Component、Integration Test を含める |
| e2e | `mise run test:e2e` | TBD | Maestro の実行環境が固まってから必須化を判断する |

## 未解決事項

- GitHub Actions で mise をセットアップする方法。
- E2E Test を GitHub Actions で実行するか、EAS Workflows で実行するか。
- tmux 実プロセスを使う Integration Test を CI で実行するか。

