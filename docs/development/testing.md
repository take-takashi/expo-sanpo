# Testing Strategy

## 方針

React Native と Expo を中心にするため、Unit Test、Component Test、Integration Test の標準テストランナーは Jest に寄せる。

Vitest は Node.js プロジェクトでは有力だが、このプロジェクトでは iPhone アプリと Mac 側ブリッジでテスト基盤を分けすぎないことを優先する。Mac 側ブリッジが大きくなり、Jest より Vitest の利点が明確になった場合に再検討する。

E2E Test には Maestro を使う。

## テスト種別

| 種別 | 採用候補 | 対象 | 備考 |
| --- | --- | --- | --- |
| Unit Test | Jest | 純粋関数、Zod スキーマ、tmux 出力パーサー、ブリッジ内部ロジック | React Native と Node.js の両方で使う |
| Component Test | Jest + React Native Testing Library | iPhone アプリの画面、フォーム、状態表示 | Expo と React Native の標準的な構成に寄せる |
| Integration Test | Jest | Mac 側ブリッジ API、tmux アダプター境界、Zod バリデーション | tmux 実プロセスを使うテストとモックテストを分ける |
| E2E Test | Maestro | ユーザー操作から主要画面まで | Expo Go で可能な範囲から始め、Development Build 移行時に拡張する |

## 初期検証で重視するテスト

- Zod スキーマが iPhone アプリと Mac 側ブリッジの API 契約として機能すること。
- tmux control mode の `%output` をアプリ向けイベントへ変換できること。
- プロンプト送信、応答表示、読み上げ操作の主要 UI が壊れないこと。
- ブリッジ API が認証無しで動かないこと。

## mise tasks

テストはすべて mise tasks 経由で実行する。

| 目的 | コマンド | 備考 |
| --- | --- | --- |
| Unit Test | `mise run test:unit` | Jest |
| Component Test | `mise run test:component` | Jest + React Native Testing Library |
| Integration Test | `mise run test:integration` | Jest |
| E2E Test | `mise run test:e2e` | Maestro |
| 全テスト | `mise run test` | 上記をまとめる |
| 総合検証 | `mise run check` | Lint、Format 確認、型チェック、テスト |

## 未解決事項

- Expo Go を対象にした Maestro の実行方法。
- CI 上で E2E Test を必須にするか、別ジョブまたは手動ジョブにするか。
- tmux 実プロセスを使う Integration Test を CI で実行するか。

