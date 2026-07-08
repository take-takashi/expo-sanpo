# Development Setup

このドキュメントには、ローカル開発環境の準備手順を記録する。

## 前提条件

| ツール | バージョン | 用途 | インストール方法 |
| --- | --- | --- | --- |
| mise | 2026.6.14 で検証 | ツールバージョン管理とタスクランナー | 公式手順で事前に導入する |
| Node.js | 24 | JavaScript または TypeScript の実行基盤 | `mise install` |
| pnpm | 11.9.0 | Node.js 依存関係の管理 | `mise install` |
| Biome | 2.5.2 | Lint と Format | `mise install` |
| uv | 0.11.26 | Irodori-TTS の Python 依存関係と実行 | `mise install` |

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
| `EXPO_SANPO_PROMPT_DRIVER` | 任意 | prompt 実行方式を切り替える | `tmux`, `codex`, `codex-app-server` |
| `EXPO_SANPO_CODEX_COMMAND` | 任意 | Codex CLI の実行コマンド | `codex` |
| `EXPO_SANPO_CODEX_WORKDIR` | 任意 | Codex CLI を起動する作業ディレクトリ | リポジトリルート |
| `EXPO_SANPO_CODEX_APP_SERVER_TURN_TIMEOUT_MS` | 任意 | codex-app-server driver の turn 完了待ち timeout | `600000` |
| `EXPO_SANPO_CODEX_SUBMIT_KEYS` | 任意 | Codex CLI へ prompt を送信する tmux キー列 | `Escape,Enter` |
| `EXPO_SANPO_TMUX_SESSION_PREFIX` | 任意 | tmux セッション名の prefix | `expo-sanpo` |
| `EXPO_SANPO_IRODORI_TTS_DIR` | 任意 | Irodori-TTS 本体 repo のパス | `~/fork/Irodori-TTS` |
| `EXPO_SANPO_IRODORI_TTS_HOST` | 任意 | Irodori-TTS HTTP サーバーの listen host | `127.0.0.1` |
| `EXPO_SANPO_IRODORI_TTS_PORT` | 任意 | Irodori-TTS HTTP サーバーの listen port | `8788` |
| `IRODORI_TTS_HF_CHECKPOINT` | 任意 | Hugging Face checkpoint repo | `Aratako/Irodori-TTS-500M-v3` |
| `IRODORI_TTS_CHECKPOINT` | 任意 | ローカル checkpoint file | `model.safetensors` |
| `IRODORI_TTS_NUM_STEPS` | 任意 | Irodori-TTS の sampling step 数 | `6` |
| `IRODORI_TTS_T_SCHEDULE_MODE` | 任意 | Irodori-TTS の timestep schedule | `sway` |
| `IRODORI_TTS_SWAY_COEFF` | 任意 | Sway Sampling 係数 | `-1.0` |
| `IRODORI_TTS_PREWARM_TEXT` | 任意 | 起動時に事前合成する短文 | `こんにちは。` |

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

Codex CLI の起動と画面取得だけを検証する場合は、次のように起動する。

```sh
EXPO_SANPO_PROMPT_DRIVER=codex mise run dev:bridge
```

この段階では tmux 上に `codex --no-alt-screen` を起動し、prompt を入力して送信キーを送った後、送信前後の `capture-pane` 差分を返す。送信キーはデフォルトで `Escape` + `Enter` とし、Codex CLI 側の Option+Enter 送信設定を tmux から再現する。Mac 側の Codex CLI 設定が異なる場合は、`EXPO_SANPO_CODEX_SUBMIT_KEYS=Enter` のように tmux キー列をカンマ区切りで指定する。`EXPO_SANPO_CODEX_WORKDIR` を指定すると、Codex CLI の起動ディレクトリを明示できる。完了判定は未実装であり、送信後に短く待ってから画面 capture を返す。

Codex app-server の構造化イベント取得を検証する場合は、次のように起動する。

```sh
EXPO_SANPO_PROMPT_DRIVER=codex-app-server mise run dev:bridge
```

この driver は `codex app-server --listen stdio://` を子プロセスとして起動し、bridge の sessionId ごとに Codex thread を作成または再利用する。prompt 送信時は `turn/start` を使い、`agentMessage.phase = final_answer` の completed item だけを assistant message として返す。`EXPO_SANPO_CODEX_WORKDIR` を指定すると、thread と turn の作業ディレクトリを明示できる。turn が完了しない場合は、既定で 10 分後に timeout する。

## Irodori-TTS サーバー

Irodori-TTS の依存関係を初回セットアップする場合は、次のコマンドを使う。

```sh
mise run tts:irodori:install
```

このコマンドは、既定では `~/fork/Irodori-TTS` で `uv sync --extra cpu` を実行する。repo の場所が異なる場合は、`EXPO_SANPO_IRODORI_TTS_DIR` を指定する。macOS では `cpu` extra が PyPI の PyTorch wheel を使うため、MPS もこの環境で利用する。

Mac 内だけでローカル HTTP サーバーを起動する場合は、次のコマンドを使う。

```sh
mise run dev:tts:irodori
```

このコマンドは既定で `http://127.0.0.1:8788` に `/health` と `/v1/audio/speech` を提供する。`127.0.0.1` は Mac 内部専用であり、iPhone など別端末からは接続できない。

iPhone 実機から使う場合は、次のコマンドで LAN または Tailscale 向けに起動する。

```sh
mise run dev:tts:irodori:lan
```

このコマンドは `0.0.0.0:8788` で待ち受ける。アプリの TTS で `Remote` を選び、Remote TTS URL に Mac の到達可能な IP または Tailscale hostname と `:8788` を指定する。`/v1/audio/speech` は OpenAI TTS API に近い request body を受け取るが、現時点では `response_format = wav` のみを返す。長文の remote TTS では、アプリが `/v1/audio/speech/jobs` で job を作り、`GET /v1/audio/speech/jobs/:jobId` で ready になった chunk を確認し、`GET /v1/audio/speech/jobs/:jobId/chunks/:index.wav` を順番に再生する。サーバーは改行、句点、長さをもとに chunk を分割する。推論は Irodori-TTS の MPS 並列実行を避けるため、サーバープロセス内で直列化する。

高速化の初期値として、`IRODORI_TTS_NUM_STEPS=6`、`IRODORI_TTS_T_SCHEDULE_MODE=sway`、`IRODORI_TTS_SWAY_COEFF=-1.0` を使う。初回合成の待ち時間を先に吸収したい場合は、`IRODORI_TTS_PREWARM_TEXT` に短い文を指定して起動する。

## トラブルシュート

よくある問題と解決方法を記載する。

| 症状 | 原因 | 対応 |
| --- | --- | --- |
| `pnpm install` が `ERR_PNPM_IGNORED_BUILDS` で失敗する | pnpm 11 の build script 承認が未反映である | `pnpm-workspace.yaml` の `onlyBuiltDependencies` を確認し、必要な依存だけを承認する |
