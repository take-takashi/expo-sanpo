# Development Commands

このドキュメントには、日常開発で使うコマンドとタスクランナーの入口を記録する。

実在するコマンドだけを記載する。すべてのタスクランナー入口は mise tasks に集約し、可能な限り mise tasks 以外のコマンドを直接使わない。

Expo プロジェクトの初期化後に、開発、テスト、Lint、Format、ビルドの mise task を追加する。

## コマンド一覧

| 目的 | コマンド | 備考 |
| --- | --- | --- |
| ツールのインストール | `mise install` | `mise.toml` を参照する |
| 依存関係のインストール | `mise run install` | pnpm workspace 全体をインストールする |
| 開発サーバーの起動 | `mise run dev` | `apps/mobile` の Expo 開発サーバーを起動する |
| ブリッジ開発サーバーの起動 | `mise run dev:bridge` | `apps/bridge` の Hono サーバーを起動する |
| Irodori-TTS 依存関係のインストール | `mise run tts:irodori:install` | `~/fork/Irodori-TTS` で `uv sync --extra cpu` を実行する |
| Irodori-TTS サーバーの起動 | `mise run dev:tts:irodori` | ローカルの Irodori-TTS HTTP サーバーを `127.0.0.1:8788` で起動する |
| Irodori-TTS サーバーの LAN 起動 | `mise run dev:tts:irodori:lan` | iPhone など別端末から接続できるように `0.0.0.0:8788` で起動する |
| Unit Test | `mise run test:unit` | Jest を呼ぶ。現時点では contracts と bridge を対象にする |
| Component Test | `mise run test:component` | workspace script が追加されるまでは no-op である |
| Integration Test | `mise run test:integration` | workspace script が追加されるまでは no-op である |
| E2E Test | `mise run test:e2e` | Maestro 導入までは no-op である |
| 全テスト | `mise run test` | 上記テストをまとめる |
| Lint | `mise run lint` | Biome を呼ぶ |
| Format | `mise run format` | Biome を呼ぶ |
| Format 確認 | `mise run format:check` | Biome を呼ぶ |
| ビルド | `mise run build` | Expo と Mac 側ブリッジの扱いを決めてから定義する |
| 型チェック | `mise run typecheck` | TypeScript を workspace ごとに実行する |
| 総合検証 | `mise run check` | Lint、Format 確認、型チェック、テストをまとめる |

## タスクランナー

このプロジェクトで使うタスクランナーと、各コマンドの定義場所を記載する。

| ツール | 定義場所 | 用途 |
| --- | --- | --- |
| mise tasks | `mise.toml` | 開発コマンドの単一入口 |
| pnpm | `mise.toml`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Node.js 依存関係の管理 |
| uv | `mise.toml`, `~/fork/Irodori-TTS/uv.lock` | Irodori-TTS の Python 依存関係と実行環境の管理 |
| Biome | `mise.toml`, `biome.json` | Lint と Format |
| Jest | `mise.toml`, Jest 設定ファイル | Unit、Component、Integration Test |
| Maestro | `mise.toml`, `.maestro/` | E2E Test |

## CI との対応

ローカルで実行する検証コマンドと、CI で実行されるジョブの対応を記載する。

| ローカルコマンド | CI ジョブ | 備考 |
| --- | --- | --- |
| `mise run check` | `check` | GitHub Actions の `.github/workflows/check.yml` で実行する |
| `mise run test:e2e` | TBD | 実行環境が重い場合は別ジョブに分ける |

## 更新ルール

- コマンド名、タスクランナー、CI ジョブを変更した場合は、このファイルを更新する。
- 技術スタックやツール自体を変更した場合は、`docs/architecture/tech-stack.md` も更新する。
