import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

import type { PromptRunner } from "./prompt-runner.js";

const execFile = promisify(nodeExecFile);

type ExecFile = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
type Delay = (milliseconds: number) => Promise<void>;

const defaultDelay: Delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export class CodexPromptRunner implements PromptRunner {
  readonly #codexCommand: string;
  readonly #execFile: ExecFile;
  readonly #delay: Delay;
  readonly #sessionPrefix: string;
  readonly #workingDirectory: string;

  constructor({
    codexCommand = "codex",
    execFile: run = execFile,
    delay = defaultDelay,
    sessionPrefix = "expo-sanpo-codex",
    workingDirectory = process.cwd(),
  }: {
    codexCommand?: string;
    execFile?: ExecFile;
    delay?: Delay;
    sessionPrefix?: string;
    workingDirectory?: string;
  } = {}) {
    this.#codexCommand = codexCommand;
    this.#execFile = run;
    this.#delay = delay;
    this.#sessionPrefix = sessionPrefix;
    this.#workingDirectory = workingDirectory;
  }

  getReadyMessage() {
    return "Session is ready. Codex CLI tmux session will be started on first prompt.";
  }

  async runPrompt(sessionId: string, prompt: string) {
    const tmuxSessionName = this.#getTmuxSessionName(sessionId);

    await this.#ensureSession(tmuxSessionName);
    await this.#capturePaneUntilInputReady(tmuxSessionName);
    await this.#execFile("tmux", ["send-keys", "-t", tmuxSessionName, "-l", prompt]);
    await this.#delay(1000);
    await this.#execFile("tmux", ["send-keys", "-t", tmuxSessionName, "Escape", "Enter"]);
    await this.#delay(5000);

    const output = await this.#capturePane(tmuxSessionName);

    return output || "Codex tmux pane is empty.";
  }

  async #capturePane(tmuxSessionName: string) {
    const { stdout } = await this.#execFile("tmux", [
      "capture-pane",
      "-p",
      "-t",
      tmuxSessionName,
      "-S",
      "-80",
    ]);

    return stdout.trimEnd();
  }

  async #capturePaneUntilInputReady(tmuxSessionName: string) {
    let lastOutput = "";

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await this.#delay(500);
      lastOutput = await this.#capturePane(tmuxSessionName);

      if (lastOutput.includes("Context")) {
        return lastOutput;
      }
    }

    return lastOutput;
  }

  async #ensureSession(tmuxSessionName: string) {
    try {
      await this.#execFile("tmux", ["has-session", "-t", tmuxSessionName]);
    } catch {
      await this.#execFile("tmux", [
        "new-session",
        "-d",
        "-s",
        tmuxSessionName,
        "-c",
        this.#workingDirectory,
        this.#codexCommand,
        "--no-alt-screen",
      ]);
    }
  }

  #getTmuxSessionName(sessionId: string) {
    return `${this.#sessionPrefix}-${sessionId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  }
}
