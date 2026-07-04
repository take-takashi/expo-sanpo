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

  async runPrompt(sessionId: string, _prompt: string) {
    const tmuxSessionName = this.#getTmuxSessionName(sessionId);

    await this.#ensureSession(tmuxSessionName);
    const output = await this.#capturePaneWhenReady(tmuxSessionName);

    return output || "Codex tmux pane is empty.";
  }

  async #capturePaneWhenReady(tmuxSessionName: string) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await this.#delay(500);
      const { stdout } = await this.#execFile("tmux", [
        "capture-pane",
        "-p",
        "-t",
        tmuxSessionName,
        "-S",
        "-40",
      ]);
      const output = stdout.trimEnd();

      if (output.length > 0) {
        return output;
      }
    }

    return "";
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
