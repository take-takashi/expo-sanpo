# Development Commands

このドキュメントには、日常開発で使うコマンドとタスクランナーの入口を記録する。

実在するコマンドだけを記載する。すべてのタスクランナー入口は mise tasks に集約し、可能な限り mise tasks 以外のコマンドを直接使わない。

Expo プロジェクトの初期化後に、開発、テスト、Lint、Format、ビルドの mise task を追加する。

## コマンド一覧

| 目的 | コマンド | 備考 |
| --- | --- | --- |
| ツールのインストール | `mise install` | `mise.toml` を参照する |
| 依存関係のインストール | `mise run install` | 実装時に pnpm を呼ぶ task として定義する |
| 開発サーバーの起動 | `mise run dev` | Expo 初期化後に定義する |
| Unit Test | `mise run test:unit` | Jest を呼ぶ task として定義する |
| Component Test | `mise run test:component` | Jest + React Native Testing Library を呼ぶ task として定義する |
| Integration Test | `mise run test:integration` | Jest を呼ぶ task として定義する |
| E2E Test | `mise run test:e2e` | Maestro を呼ぶ task として定義する |
| 全テスト | `mise run test` | 上記テストをまとめる task として定義する |
| Lint | `mise run lint` | Biome を呼ぶ task として定義する |
| Format | `mise run format` | Biome を呼ぶ task として定義する |
| Format 確認 | `mise run format:check` | Biome を呼ぶ task として定義する |
| ビルド | `mise run build` | Expo と Mac 側ブリッジの扱いを決めてから定義する |
| 型チェック | `mise run typecheck` | TypeScript 設定後に定義する |
| 総合検証 | `mise run check` | Lint、Format 確認、型チェック、テストをまとめる task として定義する |

## タスクランナー

このプロジェクトで使うタスクランナーと、各コマンドの定義場所を記載する。

| ツール | 定義場所 | 用途 |
| --- | --- | --- |
| mise tasks | `mise.toml` | 開発コマンドの単一入口 |
| pnpm | `mise.toml`, `pnpm-lock.yaml` | Node.js 依存関係の管理 |
| Biome | `mise.toml`, `biome.json` | Lint と Format |
| Jest | `mise.toml`, Jest 設定ファイル | Unit、Component、Integration Test |
| Maestro | `mise.toml`, `.maestro/` | E2E Test |

## CI との対応

ローカルで実行する検証コマンドと、CI で実行されるジョブの対応を記載する。

| ローカルコマンド | CI ジョブ | 備考 |
| --- | --- | --- |
| `mise run check` | TBD | CI の基本検証にする |
| `mise run test:e2e` | TBD | 実行環境が重い場合は別ジョブに分ける |

## 更新ルール

- コマンド名、タスクランナー、CI ジョブを変更した場合は、このファイルを更新する。
- 技術スタックやツール自体を変更した場合は、`docs/architecture/tech-stack.md` も更新する。
