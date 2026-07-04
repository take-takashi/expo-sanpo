import { CodexPromptRunner } from "./codex-prompt-runner.js";

describe("CodexPromptRunner", () => {
  it("starts a codex tmux session and captures output", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const runner = new CodexPromptRunner({
      codexCommand: "codex-test",
      delay: async () => {},
      execFile: async (file, args) => {
        calls.push({ file, args });

        if (args[0] === "has-session") {
          throw new Error("missing session");
        }

        if (args[0] === "capture-pane") {
          return { stdout: "Codex is ready\n", stderr: "" };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "codex-test",
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session 1", "Hello")).resolves.toBe("Codex is ready");
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
        args: ["capture-pane", "-p", "-t", "codex-test-session-1", "-S", "-40"],
      },
    ]);
  });
});
