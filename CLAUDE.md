# CLAUDE.md

## 基本方針

- すべての回答は日本語で書く。
- 日本語の助詞を省略しない。
- 作業前に、関連する `docs/` 配下の文書と `docs/lessons.md` を確認する。
- 仕様、ドキュメント、実装が矛盾している場合は、勝手に片方へ合わせず、差分と判断が必要な点を明示する。
- 秘密情報の値は、ドキュメント、ログ、コミットに含めない。

## プロジェクト概要

`expo-sanpo` は、Expo を使って、散歩しながら何か作業する仕組みを作るプロジェクトである。

## 技術スタック

- バージョン管理は `mise.toml` を参照する。
- 現時点では `mise.toml` で Node.js 24 を指定している。
- 採用技術の詳細は `docs/architecture/tech-stack.md` に記録する。

## 開発コマンド

- 実在するコマンドだけを `docs/development/commands.md` に記録する。
- コマンドを追加または変更した場合は、`docs/development/commands.md` を更新する。
- セットアップ手順を追加または変更した場合は、`docs/development/setup.md` を更新する。
- 開発コマンドは `mise tasks` に集約し、可能な限り `mise run ...` 経由で実行する。
- ツールは `mise.toml` で管理し、ローカル環境に暗黙依存しない。

## ディレクトリ構成

- `docs/product/`: 目的、背景、ユーザー価値、PRD、業務フローを置く。
- `docs/specs/`: 機能仕様、画面仕様、状態遷移、受け入れ条件を置く。
- `docs/architecture/`: システム構成、技術方針、技術スタック、データモデル、外部連携を置く。
- `docs/development/`: セットアップ、コマンド、日常の開発ワークフローを置く。
- `docs/decisions/`: 重要な判断とその理由を置く。
- `docs/operations/`: リリース、障害対応、環境管理などの運用手順を置く。
- `docs/glossary.md`: 用語の意味や表記を置く。
- `docs/lessons.md`: AI 協働時に繰り返し参照すべき教訓を置く。

## ドキュメント更新

- 実装を変更した場合は、関連する仕様、設計、開発手順の文書も確認する。
- 技術スタックを変更した場合は、`docs/architecture/tech-stack.md` を更新する。
- 開発フローを変更した場合は、`docs/development/workflow.md` を更新する。
- 重要な意思決定を行った場合は、`docs/decisions/` に記録する。
- 繰り返し発生した指摘や次回以降も守るべき教訓がある場合は、`docs/lessons.md` を更新する。

## Git 運用

- ユーザーが作成した変更を勝手に戻さない。
- 変更前に `git status --short --branch` で作業ツリーを確認する。
- コミットする場合は、差分と検証結果を確認してから行う。
