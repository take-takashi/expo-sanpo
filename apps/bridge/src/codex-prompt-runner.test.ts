import { CodexPromptRunner } from "./codex-prompt-runner.js";

describe("CodexPromptRunner", () => {
  it("starts a codex tmux session, sends a prompt, and captures output", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const delays: number[] = [];
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
          return { stdout: "Codex is ready Context 100% left\n", stderr: "" };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session 1", "Hello")).resolves.toBe(
      "Codex is ready Context 100% left",
    );
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
              captureCount === 1 ? "model: loading\n" : "gpt-5.5 medium · Context 100% left\n",
            stderr: "",
          };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
      workingDirectory: "/repo",
    });

    await runner.runPrompt("session 1", "Hello");
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
});
