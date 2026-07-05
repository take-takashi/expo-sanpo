import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

import type { PromptRunner } from "./prompt-runner.js";

const execFile = promisify(nodeExecFile);

const defaultSubmitKeys = ["Escape", "Enter"];

type ExecFile = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
type Delay = (milliseconds: number) => Promise<void>;

const defaultDelay: Delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export function extractCodexPromptOutput({
  afterPrompt,
  beforePrompt,
  prompt,
}: {
  afterPrompt: string;
  beforePrompt: string;
  prompt: string;
}) {
  let output = afterPrompt;

  if (beforePrompt.length > 0 && output.startsWith(beforePrompt)) {
    output = output.slice(beforePrompt.length);
  }

  const promptMarkerIndex = output.lastIndexOf(getPromptMarker(prompt));

  if (promptMarkerIndex >= 0) {
    output = output.slice(promptMarkerIndex);
  }

  output = stripPromptEcho(output, prompt);
  output = stripTrailingInputPrompt(output);

  return output.trim();
}

export class CodexPromptRunner implements PromptRunner {
  readonly #codexCommand: string;
  readonly #execFile: ExecFile;
  readonly #delay: Delay;
  readonly #sessionPrefix: string;
  readonly #submitKeys: string[];
  readonly #workingDirectory: string;

  constructor({
    codexCommand = "codex",
    execFile: run = execFile,
    delay = defaultDelay,
    sessionPrefix = "expo-sanpo-codex",
    submitKeys = defaultSubmitKeys,
    workingDirectory = process.cwd(),
  }: {
    codexCommand?: string;
    execFile?: ExecFile;
    delay?: Delay;
    sessionPrefix?: string;
    submitKeys?: string[] | undefined;
    workingDirectory?: string;
  } = {}) {
    this.#codexCommand = codexCommand;
    this.#execFile = run;
    this.#delay = delay;
    this.#sessionPrefix = sessionPrefix;
    this.#submitKeys = submitKeys;
    this.#workingDirectory = workingDirectory;
  }

  getReadyMessage() {
    return "Session is ready. Codex CLI tmux session will be started on first prompt.";
  }

  async runPrompt(sessionId: string, prompt: string) {
    const tmuxSessionName = this.#getTmuxSessionName(sessionId);

    await this.#ensureSession(tmuxSessionName);
    const beforePrompt = await this.#capturePaneUntilInputReady(tmuxSessionName);
    await this.#execFile("tmux", ["send-keys", "-t", tmuxSessionName, "-l", prompt]);
    await this.#delay(1000);
    await this.#execFile("tmux", ["send-keys", "-t", tmuxSessionName, ...this.#submitKeys]);

    const afterPrompt = await this.#capturePaneAfterPromptCompletes({
      beforePrompt,
      prompt,
      tmuxSessionName,
    });
    const output = extractCodexPromptOutput({ afterPrompt, beforePrompt, prompt });

    return output || afterPrompt || "Codex tmux pane is empty.";
  }

  async #capturePaneAfterPromptCompletes({
    beforePrompt,
    prompt,
    tmuxSessionName,
  }: {
    beforePrompt: string;
    prompt: string;
    tmuxSessionName: string;
  }) {
    let lastOutput = "";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await this.#delay(attempt === 0 ? 5000 : 2000);
      lastOutput = await this.#capturePane(tmuxSessionName);
      const promptOutput = extractCodexPromptOutput({
        afterPrompt: lastOutput,
        beforePrompt,
        prompt,
      });

      if (promptOutput.length > 0 && !isCodexOutputInProgress(promptOutput)) {
        return lastOutput;
      }
    }

    return lastOutput;
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

function getPromptMarker(prompt: string) {
  return `› ${prompt}`;
}

function stripPromptEcho(output: string, prompt: string) {
  const trimmed = output.trim();
  const promptMarker = getPromptMarker(prompt);

  if (trimmed.startsWith(promptMarker)) {
    return trimmed.slice(promptMarker.length).trim();
  }

  return trimmed;
}

function isCodexOutputInProgress(output: string) {
  return output.includes("Working (") || output.includes("esc to interrupt");
}

function stripTrailingInputPrompt(output: string) {
  const promptMarkerIndex = output.lastIndexOf("\n› ");

  if (promptMarkerIndex > 0 && output.slice(0, promptMarkerIndex).includes("•")) {
    return output.slice(0, promptMarkerIndex).trimEnd();
  }

  return output;
}
