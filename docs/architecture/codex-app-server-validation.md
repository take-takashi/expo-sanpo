# Codex App Server 検証メモ

## 目的

TTS の読み上げ対象を、tmux の画面出力から推測するのではなく、Codex CLI 側の構造化イベントから判別できるかを検証する。

この検証では、コードブロックの判別は対象外にする。まずは、thinking、コマンド出力、ファイル変更、最終回答を分離できるかを確認する。

## 検証日

2026-07-06

## 検証対象

- Codex CLI の `app-server`
- Codex CLI の `codex debug app-server send-message-v2`
- Codex CLI の `codex app-server generate-json-schema`

## 参照した公式ドキュメント

- Codex App Server: <https://developers.openai.com/codex/app-server>
- Codex CLI reference: <https://developers.openai.com/codex/cli/reference>
- Codex non-interactive mode: <https://developers.openai.com/codex/noninteractive>
- Codex SDK: <https://developers.openai.com/codex/sdk>

## 実行したコマンド

```sh
codex app-server --help
codex app-server generate-json-schema --experimental --out /tmp/expo-sanpo-codex-app-server-schema
codex debug app-server send-message-v2 --help
codex debug app-server send-message-v2 "Reply with exactly one short Japanese sentence. Do not run commands or edit files."
codex debug app-server send-message-v2 "Run pwd once, then answer in one short Japanese sentence with the current directory name only."
codex debug app-server send-message-v2 "Create /tmp/expo-sanpo-app-server-validation.txt with the text app-server-validation, then answer in one short Japanese sentence that the file was created."
```

最初の `send-message-v2` は、通常の sandbox 内では次の理由で失敗した。

```text
Error: failed to initialize sqlite state runtime under /Users/takashi/.codex
codex app-server closed stdout
```

そのため、app-server の検証には、通常の `$CODEX_HOME`、認証情報、SQLite state にアクセスできる実行環境が必要である。Mac 側ブリッジから実装する場合も、bridge プロセスが Codex CLI と同じユーザー権限で app-server を子プロセスとして起動する構成が自然である。

## スキーマで確認したイベント

`generate-json-schema` の出力には、次の通知スキーマが含まれていた。

- `v2/AgentMessageDeltaNotification.json`
- `v2/ReasoningTextDeltaNotification.json`
- `v2/ReasoningSummaryTextDeltaNotification.json`
- `v2/CommandExecutionOutputDeltaNotification.json`
- `v2/ItemCompletedNotification.json`

`ItemCompletedNotification` の `ThreadItem` には、少なくとも次のような種別が含まれていた。

- `agentMessage`
- `reasoning`
- `commandExecution`
- `fileChange`
- `userMessage`

`agentMessage` には `phase` があり、`commentary` と `final_answer` を表現できる。ただし、スキーマ上は `phase` が常に安定して入るとは限らず、`null` を unknown として扱う必要がある。

## 短い回答の観測結果

短い日本語文だけを返す指示では、次のイベント構造を観測した。

- `item/started` と `item/completed` で `userMessage` が流れた。
- `item/started` と `item/completed` で `reasoning` が流れた。
- `item/started` と `item/completed` で `agentMessage` が流れた。
- `agentMessage` の `phase` は `final_answer` だった。
- `agentMessage` の本文は `承知しました。` だった。
- 最後に `turn/completed` が流れ、status は `completed` だった。

このケースでは、TTS は `agentMessage` かつ `phase = final_answer` だけを読み上げればよい。

## コマンド実行の観測結果

`pwd` を一度実行してから回答する指示では、次のイベント構造を観測した。

- `commandExecution` が `item/started` と `item/completed` で分離されて流れた。
- `commandExecution` には `/bin/zsh -lc pwd`、`cwd`、`status`、`exitCode`、`aggregatedOutput` が含まれた。
- `aggregatedOutput` には `/Users/takashi/github/expo-sanpo\n` が入っていた。
- その後で `agentMessage` が流れた。
- `agentMessage` の `phase` は `final_answer` だった。
- `agentMessage` の本文は `現在のディレクトリ名は expo-sanpo です。` だった。

このケースでは、コマンド出力は `commandExecution` として構造的に分離されている。TTS は `commandExecution` を既定では読み上げず、最終回答だけを読み上げられる。

## ファイル変更の観測結果

`/tmp/expo-sanpo-app-server-validation.txt` を作成する指示では、実際に次のファイルが作成された。

```text
/tmp/expo-sanpo-app-server-validation.txt
```

ファイルの内容は次の通りだった。

```text
app-server-validation
```

この検証では、debug コマンドの出力が長くなり、ファイル変更イベントの詳細ログは十分に保存できなかった。そのため、`fileChange` の具体的な payload は追加検証が必要である。

## debug コマンドの制約

`codex debug app-server send-message-v2` は、completed item の分類確認には有用だった。

一方で、この debug client は初期化時に次の delta 通知を opt out していた。

- `command/exec/outputDelta`
- `item/agentMessage/delta`
- `item/plan/delta`
- `item/fileChange/outputDelta`
- `item/reasoning/summaryTextDelta`
- `item/reasoning/textDelta`

そのため、ストリーミング途中の delta をアプリに流せるかは、bridge 側で app-server stdio client を実装して追加検証する必要がある。

## 判断材料

app-server は、tmux の画面出力よりも TTS の読み上げ対象を判定しやすい。

理由は次の通りである。

- thinking は `reasoning` として分離される。
- コマンド実行は `commandExecution` として分離される。
- 最終回答は `agentMessage` として分離される。
- 観測した範囲では、最終回答の `agentMessage.phase` は `final_answer` だった。
- `turn/completed` により、ターンの完了を構造的に判定できる。

ただし、現時点では次の制約がある。

- `phase` が常に入る前提にはできない。
- delta streaming は debug client では検証できていない。
- `fileChange` payload は追加検証が必要である。
- app-server を利用するには、Codex CLI の認証情報と state にアクセスできる実行環境が必要である。

## TTS 方針への示唆

初期の TTS 方針は、次のルールで十分に始められる。

- `agentMessage` 以外は既定では読み上げない。
- `agentMessage.phase = final_answer` は読み上げる。
- `agentMessage.phase = commentary` は既定では読み上げない。
- `reasoning`、`commandExecution`、`fileChange`、`userMessage` は読み上げない。
- `phase` が unknown の場合は、`turn/completed` 後の completed `agentMessage` だけを候補にする。
- `item/completed` で final answer を拾えない場合は、`turn/completed.turn.items` 内の `agentMessage` も候補にする。

bridge 内部では、app-server のイベントをそのまま UI に露出するのではなく、次のようなアプリ向けイベントへ正規化するのがよい。

```ts
type BridgeMessageKind =
  | "userMessage"
  | "agentMessage"
  | "reasoning"
  | "commandExecution"
  | "fileChange"
  | "plan";

type BridgeMessagePhase = "final_answer" | "commentary" | "unknown";

type BridgeMessage = {
  id: string;
  kind: BridgeMessageKind;
  phase: BridgeMessagePhase;
  text: string;
  speakable: boolean;
};
```

## 次の検証

次の実装では、Mac 側ブリッジから `codex app-server stdio://` を子プロセスとして起動する小さな spike を作る。

その spike では、次を確認する。

- debug client ではなく、bridge 側 client で delta 通知を受け取れるか。
- `agentMessage` の delta と completed item を対応づけられるか。
- `turn/completed` を使って TTS 開始タイミングを安定させられるか。
- `fileChange` の payload を UI 表示用に安全に要約できるか。
- app-server プロセスの起動、終了、異常終了を bridge のセッション管理に統合できるか。
