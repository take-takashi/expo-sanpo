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

export class TmuxPromptRunner implements PromptRunner {
  readonly #execFile: ExecFile;
  readonly #delay: Delay;
  readonly #sessionPrefix: string;

  constructor({
    execFile: run = execFile,
    delay = defaultDelay,
    sessionPrefix = "expo-sanpo",
  }: {
    execFile?: ExecFile;
    delay?: Delay;
    sessionPrefix?: string;
  } = {}) {
    this.#execFile = run;
    this.#delay = delay;
    this.#sessionPrefix = sessionPrefix;
  }

  getReadyMessage() {
    return "Session is ready. tmux echo integration is enabled.";
  }

  async runPrompt(sessionId: string, prompt: string) {
    const tmuxSessionName = this.#getTmuxSessionName(sessionId);

    await this.#ensureSession(tmuxSessionName);
    await this.#execFile("tmux", ["send-keys", "-t", tmuxSessionName, "-l", prompt]);
    await this.#execFile("tmux", ["send-keys", "-t", tmuxSessionName, "Enter"]);
    await this.#delay(50);

    const { stdout } = await this.#execFile("tmux", [
      "capture-pane",
      "-p",
      "-t",
      tmuxSessionName,
      "-S",
      "-20",
    ]);

    return stdout.trimEnd() || "tmux pane is empty.";
  }

  async #ensureSession(tmuxSessionName: string) {
    try {
      await this.#execFile("tmux", ["has-session", "-t", tmuxSessionName]);
    } catch {
      await this.#execFile("tmux", ["new-session", "-d", "-s", tmuxSessionName, "cat"]);
    }
  }

  #getTmuxSessionName(sessionId: string) {
    return `${this.#sessionPrefix}-${sessionId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  }
}
