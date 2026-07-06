# Tech Stack

このドキュメントには、このプロジェクトで採用する技術スタック、主要ツール、バージョン方針を記録する。

## 採用技術

| 領域 | 採用技術 | バージョン | 用途 | 備考 |
| --- | --- | --- | --- | --- |
| ランタイム | Node.js | 24 | JavaScript または TypeScript の実行基盤 | `mise.toml` で指定 |
| モバイルフレームワーク | Expo | 54.0.x | モバイルアプリケーション開発 | `apps/mobile` で利用する |
| UI フレームワーク | React Native | 0.81.5 | iPhone アプリケーション開発 | Expo 経由で利用する |
| ルーティング | Expo Router | 6.0.x | iPhone アプリの画面遷移 | `apps/mobile/src/app` にルートを置く |
| 端末内保存 | AsyncStorage | 2.2.0 | Bridge URL などの非秘密設定の保存 | 会話履歴の正本にはしない |
| 言語 | TypeScript | 5.9.3 | iPhone アプリと Mac 側ブリッジの実装 | ルートで共通設定を持つ |
| サーバーフレームワーク | Hono | 4.10.7 | Mac 側ブリッジサーバー | Node.js Adapter を使う |
| パッケージマネージャー | pnpm | 11.9.0 | Node.js 依存関係の管理 | git worktree 運用との相性を重視する |
| Python パッケージ管理 | uv | 0.11.26 | Irodori-TTS の依存関係管理と実行 | `mise.toml` で指定し、Irodori-TTS 側の `uv.lock` を使う |
| ツール管理 | mise | 2026.6.14 で検証 | Node.js、pnpm、Biome などのツール管理 | `mise.toml` で管理する |
| タスクランナー | mise tasks | 2026.6.14 で検証 | 開発コマンドの単一入口 | 可能な限り mise tasks 以外の直接実行を避ける |
| Lint | Biome | 2.5.2 | 静的解析 | mise 管理対象にする |
| Format | Biome | 2.5.2 | コード整形 | mise 管理対象にする |
| Unit Test | Jest | 29.7.0 | 関数、ユーティリティ、純粋ロジックの検証 | ts-jest で TypeScript を実行する |
| Component Test | Jest + React Native Testing Library | TBD | React Native コンポーネントの検証 | Expo と React Native の標準構成に寄せる |
| Integration Test | Jest | TBD | iPhone アプリ、Mac 側ブリッジ、tmux 連携境界の検証 | 境界と実行環境の設計が必要 |
| E2E Test | Maestro | TBD | ユーザー操作からリモート Codex セッションまでの検証 | Expo Go から始め、必要に応じて Development Build で拡張する |
| API 契約 | Zod | 4.1.13 | iPhone アプリと Mac 側ブリッジ間のスキーマ共有と実行時検証 | `packages/contracts` に配置する |
| SSH | TBD | TBD | iPhone から母艦の Mac へ接続する | ライブラリ選定が必要 |
| セッション管理 | tmux | TBD | Codex CLI の実行セッションを維持する | Mac 側の前提ツール |
| CLI | Codex CLI | TBD | 母艦の Mac 上で作業を実行する | tmux 上で起動する |
| VPN | Tailscale | TBD | iPhone と Mac の到達性を確保する | プロジェクトの実装対象外 |
| TTS | expo-speech | 14.0.x | iPhone 側で Codex CLI の結果を読み上げる | 初期 PoC の device モードで利用する |
| Remote TTS | Irodori-TTS | v3 checkpoint | Mac 側で自然な音声を生成する | `~/fork/Irodori-TTS` をローカル HTTP サーバーとして起動する |
| CI | TBD | TBD | TBD | TBD |
| デプロイ | TBD | TBD | TBD | TBD |

## 採用理由

- Node.js 24 は `mise.toml` で指定済みである。
- Expo はプロジェクトの目的に含まれているため、モバイル開発の前提として扱う。
- React Native は Expo で iPhone アプリを実装するために使う。
- Expo Router は iPhone アプリの画面遷移をファイルベースで管理するために使う。
- AsyncStorage は Bridge URL のような非秘密の端末内設定を保存するために使う。
- TypeScript は iPhone アプリと Mac 側ブリッジの両方で型を共有しやすくするために使う。
- Hono は Mac 側ブリッジサーバーを軽量に実装するために使う。
- pnpm は git worktree 運用との相性を重視して使う。
- uv は Irodori-TTS の Python 依存関係を、Irodori-TTS 側の `uv.lock` に従って再現するために使う。
- mise はツール管理とタスクランナーの単一入口として使う。
- Biome は Lint と Format をまとめて扱うために使う。
- Jest は React Native と Expo のテスト導線に合わせるために使う。
- Maestro は E2E Test に使う。
- Zod は iPhone アプリと Mac 側ブリッジの API 契約を共有し、実行時検証を行うために使う。
- tmux は SSH 接続先で Codex CLI のセッションを維持するために使う。
- Tailscale は VPN として利用するが、このプロジェクトでは構築や管理を対象外にする。
- expo-speech は Expo Go で読み上げ体験を先に検証するために使う。
- Irodori-TTS は remote TTS モードの候補として、Mac 側で常駐 HTTP サーバー化して利用する。
- その他の技術は、実装方針が決まり次第、この文書に記録する。

## バージョン管理方針

言語、ランタイム、パッケージマネージャー、主要ツールのバージョンをどこで固定するかを記載する。

- `mise.toml`
- `package.json`
- `pnpm-lock.yaml`

方針:

- Node.js、pnpm、Biome、uv などの開発ツールは `mise.toml` に固定する。
- 依存関係は pnpm と `pnpm-lock.yaml` で固定する。
- 開発コマンドは `mise tasks` に集約する。
- `package.json` の scripts は、必要な場合でも mise task から呼ばれる内部実装として扱う。

## 代替候補

検討したが採用しなかった候補と、その理由を記載する。

| 候補 | 不採用理由 | 備考 |
| --- | --- | --- |
| npm | git worktree 運用で pnpm を優先するため | 必要な場合のみ比較する |
| yarn | git worktree 運用で pnpm を優先するため | 必要な場合のみ比較する |
| ESLint + Prettier | Lint と Format を Biome に寄せるため | Biome で不足するルールが出た場合に再検討する |
| Vitest | React Native と Expo のテスト導線に合わせて Jest を優先するため | Mac 側ブリッジが大きくなった場合に再検討する |

## 更新ルール

- 技術スタックを変更した場合は、このファイルを更新する。
- 実行コマンドを変更した場合は、`docs/development/commands.md` も更新する。
- 採用理由が意思決定として重要な場合は、`docs/decisions/` に ADR を追加する。
