# Workflows

## 散歩中に Codex CLI へプロンプトを送る

このフローは、ユーザーが散歩中に iPhone から母艦の Mac 上の Codex CLI にプロンプトを送り、結果を確認する基本導線である。

Tailscale の設定や運用はプロジェクト対象外だが、利用前提としてフローに含める。

```mermaid
flowchart TD
    Start([開始])
    TailscaleCheck{Tailscale で iPhone から Mac へ到達できるか}
    TailscaleConnect[Tailscale 接続を有効にする]
    OpenApp[expo-sanpo を起動する]
    SelectConnection[接続先の Mac 側ブリッジを選択する]
    BridgeCheck{Mac 側ブリッジへ接続できるか}
    ShowConnectionError[接続エラーを表示する]
    SelectSession[tmux / Codex セッションを選択または作成する]
    SessionReady{Codex CLI を利用できるか}
    StartCodex[Mac 側ブリッジが tmux 上で Codex CLI を起動または再利用する]
    InputPrompt[プロンプトを入力する]
    SendPrompt[Mac 側ブリッジ経由で Codex CLI に送信する]
    WaitResult[応答を待つ]
    ShowResult[応答を表示する]
    TtsEnabled{読み上げが有効か}
    Speak[expo-speech で応答を読み上げる]
    Continue{会話または指示を続けるか}
    End([終了])

    Start --> TailscaleCheck
    TailscaleCheck -- いいえ --> TailscaleConnect --> TailscaleCheck
    TailscaleCheck -- はい --> OpenApp
    OpenApp --> SelectConnection
    SelectConnection --> BridgeCheck
    BridgeCheck -- いいえ --> ShowConnectionError --> SelectConnection
    BridgeCheck -- はい --> SelectSession
    SelectSession --> SessionReady
    SessionReady -- いいえ --> StartCodex --> InputPrompt
    SessionReady -- はい --> InputPrompt
    InputPrompt --> SendPrompt
    SendPrompt --> WaitResult
    WaitResult --> ShowResult
    ShowResult --> TtsEnabled
    TtsEnabled -- はい --> Speak --> Continue
    TtsEnabled -- いいえ --> Continue
    Continue -- はい --> InputPrompt
    Continue -- いいえ --> End
```

## 前提

- iPhone と母艦の Mac は Tailscale で到達可能である。
- 母艦の Mac では Mac 側ブリッジが起動している。
- 母艦の Mac には tmux と Codex CLI が導入されている。
- PoC では、Mac 側ブリッジの会話履歴はメモリに保持する。

## エラー時の扱い

| 状態 | 表示または対応 |
| --- | --- |
| Tailscale で到達できない | Tailscale 接続を確認するように表示する |
| Mac 側ブリッジへ接続できない | 接続先、ポート、認証トークンを確認するように表示する |
| tmux セッションを作成できない | Mac 側の tmux 状態を確認するように表示する |
| Codex CLI を起動できない | Mac 側の Codex CLI 設定を確認するように表示する |
| TTS が失敗する | テキスト表示は維持し、読み上げ失敗を通知する |

