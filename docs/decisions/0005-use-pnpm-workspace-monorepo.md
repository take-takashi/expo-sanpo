# 0005. pnpm workspace のモノレポ構成にする

## 状態

採用

## 背景

このプロジェクトには、iPhone アプリ、Mac 側ブリッジ、共有 API 契約が含まれる。

別リポジトリに分けると、Zod スキーマと TypeScript 型の共有、mise task、CI、変更レビューが分散する。

## 判断

pnpm workspace を使ったモノレポ構成にする。

初期構成は `apps/mobile`、`apps/bridge`、`packages/contracts` を基本にする。

## 理由

- iPhone アプリと Mac 側ブリッジで Zod スキーマを共有しやすい。
- git worktree 運用と pnpm の相性を活かせる。
- `mise run check` をリポジトリ単位の検証入口にしやすい。
- 仕様変更と実装変更を同じ PR で扱いやすい。

## 影響

- workspace の依存関係は pnpm で管理する。
- CI はルートで `mise run check` を実行する。
- アプリとブリッジの境界は `packages/contracts` の Zod スキーマで管理する。

## 未解決事項

- workspace package 名。
- tsconfig と Jest 設定の分割方針。
- E2E Test の実行対象を Expo Go にするか Development Build にするか。

