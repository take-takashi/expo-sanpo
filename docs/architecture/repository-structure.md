# Repository Structure

## 方針

このプロジェクトは pnpm workspace を使ったモノレポ構成にする。

iPhone アプリ、Mac 側ブリッジ、共有スキーマを分け、`mise tasks` を単一の実行入口にする。

## 初期構成案

```text
.
├── apps/
│   ├── mobile/
│   │   └── Expo / React Native / Expo Router の iPhone アプリ
│   └── bridge/
│       └── Node.js / Hono の Mac 側ブリッジサーバー
├── packages/
│   └── contracts/
│       └── Zod スキーマと共有 TypeScript 型
├── docs/
│   └── プロダクト、仕様、設計、開発、運用ドキュメント
├── .maestro/
│   └── E2E Test のフロー
├── mise.toml
├── pnpm-workspace.yaml
├── package.json
└── pnpm-lock.yaml
```

## パッケージ責務

| パス | 責務 |
| --- | --- |
| `apps/mobile` | Expo / React Native / Expo Router の iPhone アプリ |
| `apps/bridge` | Mac 側で動く Node.js / Hono ブリッジサーバー |
| `packages/contracts` | iPhone アプリと Mac 側ブリッジで共有する Zod スキーマと型 |
| `.maestro` | E2E Test のシナリオ |

## ルール

- workspace の依存関係管理には pnpm を使う。
- コマンド実行は `mise run ...` を入口にする。
- `apps/mobile` と `apps/bridge` は、API 型を直接重複定義せず、`packages/contracts` を参照する。
- Expo Go で動かす初期段階では、`apps/mobile` から `apps/bridge` へ HTTP で接続する。
- tmux control mode の出力をリアルタイムに扱う段階で、WebSocket を追加する。
- `apps/mobile` の画面遷移には Expo Router を使う。
- `apps/mobile` の Expo Router 画面は `apps/mobile/src/app` に置く。
- `apps/mobile/src/app` にはルート定義を置き、画面以外のコンポーネント、hooks、API クライアントは app ディレクトリ外に置く。
- `apps/bridge` の HTTP API には Hono を使う。

## 初期 package 名

| パス | package 名 |
| --- | --- |
| `apps/mobile` | `@expo-sanpo/mobile` |
| `apps/bridge` | `@expo-sanpo/bridge` |
| `packages/contracts` | `@expo-sanpo/contracts` |

## 現時点の設定方針

- TypeScript の共通設定は `tsconfig.base.json` に置く。
- Jest の共通設定はルートの `jest.config.cjs` に置く。
- Jest 実行時は `tsconfig.jest.json` で TypeScript を CommonJS として変換する。
- `apps/mobile/src/app` に Expo Router のルート定義を置く。

## 未解決事項

- Component Test、Integration Test、E2E Test の具体的な初期シナリオ。
- E2E Test の実行対象を Expo Go にするか Development Build にするか。
