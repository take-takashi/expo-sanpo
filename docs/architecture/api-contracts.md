# API Contracts

## 方針

iPhone アプリと Mac 側ブリッジの API 契約には Zod を使う。

Zod スキーマを共有パッケージに置き、リクエスト、レスポンス、イベント payload を実行時に検証する。TypeScript 型は Zod スキーマから推論し、手書きの重複型定義を避ける。

## 対象

- iPhone アプリから Mac 側ブリッジへ送るリクエスト。
- Mac 側ブリッジから iPhone アプリへ返すレスポンス。
- tmux control mode の出力をアプリ向けに整形したイベント。
- 認証エラー、接続エラー、Codex CLI の状態変化などのエラー表現。

## 初期 API 候補

| API | 用途 | 備考 |
| --- | --- | --- |
| `POST /sessions` | セッションを作成する | 初期 PoC では Mac 側ブリッジのメモリに作成し、tmux/Codex にはまだ接続しない |
| `GET /sessions/:id` | セッション状態を取得する | HTTP で開始する |
| `POST /sessions/:id/prompts` | セッションへプロンプトを送る | 初期 PoC では user message と mock assistant message をメモリに追加する |
| `GET /sessions/:id/messages` | Mac 側ブリッジが保持または再構成した会話履歴を取得する | 初期 PoC では固定の system message を返す |
| WebSocket `/sessions/:id/stream` | tmux control mode の出力イベントを購読する | `tmux -CC` 検証後に追加する |

## 通信方式

初期 PoC では HTTP を基本にする。

Mac 側ブリッジの HTTP API は Hono で実装する。

リアルタイム性、読み上げ、tmux control mode の `%output` 通知を扱う段階では WebSocket を追加する。React Native と Expo Go では WebSocket を扱いやすいため、SSE より WebSocket を優先候補にする。

## 初期 PoC 実装

現時点では `packages/contracts` に `Session`、`Message`、`POST /sessions` のレスポンス、`GET /sessions/:id/messages` のレスポンス、`POST /sessions/:id/prompts` のリクエストとレスポンスを定義する。

Mac 側ブリッジは、セッションとメッセージをプロセスメモリに保持する。ブリッジを再起動すると、この PoC のセッション情報は失われる。

`EXPO_SANPO_PROMPT_DRIVER=tmux` を指定した場合は、prompt 送信時に tmux 上の `cat` セッションへ入力し、`capture-pane` の結果を assistant message にする。

## 未解決事項

- API のエラーコード体系。
- 認証トークンの受け渡し方法。
- WebSocket の再接続、重複イベント、順序保証の扱い。
- PoC の会話履歴は Mac 側ブリッジのメモリに保持する。
