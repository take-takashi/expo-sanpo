# 0006. ブリッジ API は HTTP で始め、必要に応じて WebSocket を追加する

## 状態

採用

## 背景

Mac 側ブリッジは、iPhone アプリからのプロンプト送信、セッション状態取得、Codex CLI 出力取得を扱う。

`tmux -CC` の control mode は出力イベントを扱えるため、将来的にはリアルタイム購読が必要になる可能性が高い。

## 判断

初期 PoC では HTTP API で始める。

tmux control mode の出力をリアルタイムに扱う段階で、WebSocket を追加する。

## 理由

- HTTP は実装、デバッグ、テストが簡単である。
- Expo Go から利用しやすい。
- 最初の価値検証では、プロンプト送信と状態取得だけでも成立する。
- WebSocket は `%output` 通知や読み上げ用イベントを扱う段階で有効になる。

## 影響

- 初期 API は `POST /sessions`、`GET /sessions/:id`、`POST /sessions/:id/prompts`、`GET /sessions/:id/messages` を候補にする。
- WebSocket `/sessions/:id/stream` は control mode 検証後に追加する。
- API payload は Zod で検証する。

## 未解決事項

- HTTP polling の間隔。
- WebSocket の再接続、順序保証、重複イベントの扱い。
- 認証トークンの渡し方。

