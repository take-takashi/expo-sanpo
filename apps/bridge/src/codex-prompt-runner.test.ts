import { CodexPromptRunner, extractCodexPromptOutput } from "./codex-prompt-runner.js";

const readyScreen = [
  "╭────────────────────╮",
  "│ >_ OpenAI Codex   │",
  "╰────────────────────╯",
  "",
  "› Run /review on my current changes",
  "",
  "  gpt-5.5 medium · Context 100% left",
].join("\n");

function promptResponseScreen(prompt: string, response: string) {
  return [
    readyScreen,
    "",
    `› ${prompt}`,
    "",
    "",
    response,
    "",
    "",
    "› Run /review on my current changes",
    "",
    "  gpt-5.5 medium · Context 99% left",
  ].join("\n");
}

describe("extractCodexPromptOutput", () => {
  it("returns only the new codex output after the submitted prompt", () => {
    expect(
      extractCodexPromptOutput({
        afterPrompt: promptResponseScreen(
          "Say hello in exactly one short Japanese sentence.",
          "• こんにちは。何を進めましょうか。",
        ),
        beforePrompt: readyScreen,
        prompt: "Say hello in exactly one short Japanese sentence.",
      }),
    ).toBe("• こんにちは。何を進めましょうか。");
  });

  it("drops redrawn startup text that remains after prefix trimming", () => {
    expect(
      extractCodexPromptOutput({
        afterPrompt: ["initial", "redrawn startup text", "› Hello", "", "• Hi there."].join("\n"),
        beforePrompt: "initial",
        prompt: "Hello",
      }),
    ).toBe("• Hi there.");
  });

  it("falls back to the last submitted prompt when the previous capture is not a prefix", () => {
    expect(
      extractCodexPromptOutput({
        afterPrompt: ["old screen was redrawn", "› Hello", "", "• Hi there."].join("\n"),
        beforePrompt: "different screen",
        prompt: "Hello",
      }),
    ).toBe("• Hi there.");
  });
});

describe("CodexPromptRunner", () => {
  it("starts a codex tmux session, sends a prompt, and captures output", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const delays: number[] = [];
    let captureCount = 0;
    const runner = new CodexPromptRunner({
      codexCommand: "codex-test",
      delay: async (milliseconds) => {
        delays.push(milliseconds);
      },
      execFile: async (file, args) => {
        calls.push({ file, args });

        if (args[0] === "has-session") {
          throw new Error("missing session");
        }

        if (args[0] === "capture-pane") {
          captureCount += 1;
          return {
            stdout:
              captureCount === 1
                ? `${readyScreen}\n`
                : `${promptResponseScreen("Hello", "• Hi.")}\n`,
            stderr: "",
          };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session 1", "Hello")).resolves.toBe("• Hi.");
    expect(delays).toEqual([500, 1000, 5000]);
    expect(calls).toEqual([
      { file: "tmux", args: ["has-session", "-t", "codex-test-session-1"] },
      {
        file: "tmux",
        args: [
          "new-session",
          "-d",
          "-s",
          "codex-test-session-1",
          "-c",
          "/repo",
          "codex-test",
          "--no-alt-screen",
        ],
      },
      {
        file: "tmux",
        args: ["capture-pane", "-p", "-t", "codex-test-session-1", "-S", "-80"],
      },
      { file: "tmux", args: ["send-keys", "-t", "codex-test-session-1", "-l", "Hello"] },
      { file: "tmux", args: ["send-keys", "-t", "codex-test-session-1", "Escape", "Enter"] },
      {
        file: "tmux",
        args: ["capture-pane", "-p", "-t", "codex-test-session-1", "-S", "-80"],
      },
    ]);
  });

  it("waits for the input-ready screen before sending a prompt", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const delays: number[] = [];
    let captureCount = 0;
    const runner = new CodexPromptRunner({
      codexCommand: "codex-test",
      delay: async (milliseconds) => {
        delays.push(milliseconds);
      },
      execFile: async (file, args) => {
        calls.push({ file, args });

        if (args[0] === "has-session") {
          return { stdout: "", stderr: "" };
        }

        if (args[0] === "capture-pane") {
          captureCount += 1;
          return {
            stdout:
              captureCount === 1
                ? "model: loading\n"
                : captureCount === 2
                  ? `${readyScreen}\n`
                  : `${promptResponseScreen("Hello", "• Hi.")}\n`,
            stderr: "",
          };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session 1", "Hello")).resolves.toBe("• Hi.");
    expect(delays).toEqual([500, 500, 1000, 5000]);
    expect(calls).toEqual([
      { file: "tmux", args: ["has-session", "-t", "codex-test-session-1"] },
      {
        file: "tmux",
        args: ["capture-pane", "-p", "-t", "codex-test-session-1", "-S", "-80"],
      },
      {
        file: "tmux",
        args: ["capture-pane", "-p", "-t", "codex-test-session-1", "-S", "-80"],
      },
      { file: "tmux", args: ["send-keys", "-t", "codex-test-session-1", "-l", "Hello"] },
      { file: "tmux", args: ["send-keys", "-t", "codex-test-session-1", "Escape", "Enter"] },
      {
        file: "tmux",
        args: ["capture-pane", "-p", "-t", "codex-test-session-1", "-S", "-80"],
      },
    ]);
  });

  it("continues polling while codex is working", async () => {
    const delays: number[] = [];
    let captureCount = 0;
    const runner = new CodexPromptRunner({
      delay: async (milliseconds) => {
        delays.push(milliseconds);
      },
      execFile: async (_file, args) => {
        if (args[0] === "capture-pane") {
          captureCount += 1;
          return {
            stdout:
              captureCount === 1
                ? `${readyScreen}\n`
                : captureCount === 2
                  ? `${promptResponseScreen("Hello", "• Working (4s • esc to interrupt)")}\n`
                  : `${promptResponseScreen("Hello", "• Hi.")}\n`,
            stderr: "",
          };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
    });

    await expect(runner.runPrompt("session 1", "Hello")).resolves.toBe("• Hi.");
    expect(delays).toEqual([500, 1000, 5000, 2000]);
  });

  it("uses custom submit keys", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    let captureCount = 0;
    const runner = new CodexPromptRunner({
      delay: async () => {},
      execFile: async (file, args) => {
        calls.push({ file, args });

        if (args[0] === "capture-pane") {
          captureCount += 1;
          return {
            stdout:
              captureCount === 1
                ? `${readyScreen}\n`
                : `${promptResponseScreen("Hello", "• Hi.")}\n`,
            stderr: "",
          };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
      submitKeys: ["Enter"],
    });

    await runner.runPrompt("session 1", "Hello");
    expect(calls).toContainEqual({
      file: "tmux",
      args: ["send-keys", "-t", "codex-test-session-1", "Enter"],
    });
  });
});
