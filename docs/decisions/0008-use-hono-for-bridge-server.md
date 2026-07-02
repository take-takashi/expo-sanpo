# 0008. Mac 側ブリッジサーバーに Hono を使う

## 状態

採用

## 背景

Mac 側ブリッジは、iPhone アプリから HTTP または WebSocket で受け取り、tmux と Codex CLI を操作する小さな Node.js サーバーである。

初期段階では重いサーバーフレームワークよりも、軽量で TypeScript と相性の良い構成を優先したい。

## 判断

Mac 側ブリッジサーバーには Hono を使う。

Node.js 上では Hono の Node.js Adapter を使う。

## 理由

- Hono は軽量で、Web Standards ベースの API を使える。
- TypeScript と相性が良い。
- HTTP API から始めやすく、将来的な WebSocket 対応も検討しやすい。
- Mac 側ブリッジの責務が小さいため、Hono の薄い構成が合う。

## 影響

- `apps/bridge` は Hono アプリとして実装する。
- HTTP API の request/response payload は Zod で検証する。
- 起動コマンドは `mise run bridge:dev` などの mise task として定義する。

## 未解決事項

- WebSocket 対応を Hono で行う方法。
- Node.js サーバーの起動方法と `launchd` による常駐化。
- 認証 middleware の設計。

