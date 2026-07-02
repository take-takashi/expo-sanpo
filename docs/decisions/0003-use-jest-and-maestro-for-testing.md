# 0003. Jest と Maestro をテスト基盤にする

## 状態

採用

## 背景

このプロジェクトは React Native と Expo の iPhone アプリが中心であり、Mac 側ブリッジも TypeScript で実装する。

Vitest は Node.js 向けには有力だが、React Native と Expo の公式導線は Jest に寄っている。テスト基盤を分けると、設定、モック、CI、エージェント向け手順が複雑になる。

## 判断

Unit Test、Component Test、Integration Test は Jest を標準にする。

Component Test には React Native Testing Library を使う。

E2E Test には Maestro を使う。

## 理由

- Expo が Jest を使ったユニットテスト手順を提供している。
- React Native のテスト情報と周辺ツールは Jest 前提が多い。
- iPhone アプリと Mac 側ブリッジでテストランナーを揃えられる。
- Maestro は React Native と Expo の E2E Test と相性がよい。

## 影響

- `mise run test:unit`、`mise run test:component`、`mise run test:integration` は Jest を呼ぶ。
- `mise run test:e2e` は Maestro を呼ぶ。
- Vitest は初期採用しない。

## 再検討条件

- Mac 側ブリッジが大きくなり、Jest より Vitest の速度や開発体験が明確に有利になった場合。
- React Native 側の Jest 設定と Node.js 側の Jest 設定を共存させるコストが高くなった場合。

