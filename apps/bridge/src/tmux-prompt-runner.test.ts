import { TmuxPromptRunner } from "./tmux-prompt-runner.js";

describe("TmuxPromptRunner", () => {
  it("creates a tmux echo session, sends a prompt, and captures output", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const runner = new TmuxPromptRunner({
      delay: async () => {},
      execFile: async (file, args) => {
        calls.push({ file, args });

        if (args[0] === "has-session") {
          throw new Error("missing session");
        }

        if (args[0] === "capture-pane") {
          return { stdout: "Hello from tmux\n", stderr: "" };
        }

        return { stdout: "", stderr: "" };
      },
      sessionPrefix: "test",
    });

    await expect(runner.runPrompt("session 1", "Hello")).resolves.toBe("Hello from tmux");
    expect(calls).toEqual([
      { file: "tmux", args: ["has-session", "-t", "test-session-1"] },
      { file: "tmux", args: ["new-session", "-d", "-s", "test-session-1", "cat"] },
      { file: "tmux", args: ["send-keys", "-t", "test-session-1", "-l", "Hello"] },
      { file: "tmux", args: ["send-keys", "-t", "test-session-1", "Enter"] },
      {
        file: "tmux",
        args: ["capture-pane", "-p", "-t", "test-session-1", "-S", "-20"],
      },
    ]);
  });
});
