# pnpm Workspace

## 概要

pnpm workspace は、1 つのリポジトリ内に複数の Node.js パッケージを置き、まとめて依存関係管理できる仕組みである。

このプロジェクトでは、iPhone アプリ、Mac 側ブリッジ、共有 Zod スキーマを 1 つのリポジトリで管理するために使う。

## このプロジェクトでの使い方

```text
.
├── apps/
│   ├── mobile/
│   └── bridge/
├── packages/
│   └── contracts/
├── pnpm-workspace.yaml
├── package.json
└── pnpm-lock.yaml
```

`pnpm-workspace.yaml` には、workspace に含めるパッケージの場所を記載する。

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## 何が嬉しいか

- `apps/mobile` と `apps/bridge` から `packages/contracts` を同じリポジトリ内の依存として参照できる。
- Zod スキーマと TypeScript 型を重複定義せずに共有できる。
- `pnpm-lock.yaml` を 1 つにまとめられる。
- git worktree ごとに同じ workspace 構成を使える。
- ルートの `mise run check` で、複数パッケージの検証をまとめて実行しやすい。

## 注意点

- 依存関係を追加する対象パッケージを間違えないようにする。
- このプロジェクトでは、pnpm を直接実行せず、原則として `mise run ...` 経由で実行する。
- workspace 内のパッケージ名、依存関係、tsconfig の参照関係を揃える必要がある。

## 初期 package 名の候補

| パス | package 名候補 |
| --- | --- |
| `apps/mobile` | `@expo-sanpo/mobile` |
| `apps/bridge` | `@expo-sanpo/bridge` |
| `packages/contracts` | `@expo-sanpo/contracts` |

## build script 承認

pnpm 11 では、依存パッケージの build script を明示的に承認する必要がある。

現時点では、開発ツール経由で必要になる `esbuild` を `pnpm-workspace.yaml` の
`allowBuilds` に記録している。`onlyBuiltDependencies` には、build script を持ちうる
依存の許可範囲を記録している。

新しい依存で build script 承認が必要になった場合は、依存の用途と必要性を確認してから、
必要最小限のパッケージだけを追加する。
