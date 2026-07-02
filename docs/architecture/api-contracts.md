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
| `POST /sessions` | tmux/Codex セッションを作成または再利用する | HTTP で開始する |
| `GET /sessions/:id` | セッション状態を取得する | HTTP で開始する |
| `POST /sessions/:id/prompts` | Codex CLI にプロンプトを送る | HTTP で開始する |
| `GET /sessions/:id/messages` | Mac 側ブリッジが保持または再構成した会話履歴を取得する | HTTP で開始する |
| WebSocket `/sessions/:id/stream` | tmux control mode の出力イベントを購読する | `tmux -CC` 検証後に追加する |

## 通信方式

初期 PoC では HTTP を基本にする。

Mac 側ブリッジの HTTP API は Hono で実装する。

リアルタイム性、読み上げ、tmux control mode の `%output` 通知を扱う段階では WebSocket を追加する。React Native と Expo Go では WebSocket を扱いやすいため、SSE より WebSocket を優先候補にする。

## 未解決事項

- Zod スキーマを置く共有パッケージ名。
- API のエラーコード体系。
- 認証トークンの受け渡し方法。
- WebSocket の再接続、重複イベント、順序保証の扱い。
- PoC の会話履歴は Mac 側ブリッジのメモリに保持する。
