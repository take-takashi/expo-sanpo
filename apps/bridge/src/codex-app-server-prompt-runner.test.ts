import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { CodexAppServerPromptRunner } from "./codex-app-server-prompt-runner.js";

type JsonObject = Record<string, unknown>;

class FakeAppServerProcess extends EventEmitter {
  completeTurns = true;
  emitItemCompleted = true;
  completedAgentItem: JsonObject = {
    id: "agent-1",
    phase: "final_answer",
    text: "最終回答です。",
    type: "agentMessage",
  };
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly requests: JsonObject[] = [];
  readonly notifications: JsonObject[] = [];
  #buffer = "";
  #threadId = "thread-1";

  constructor() {
    super();
    this.stdin.on("data", (chunk) => {
      this.#buffer += chunk.toString("utf8");
      this.#readLines();
    });
  }

  #readLines() {
    while (this.#buffer.includes("\n")) {
      const newlineIndex = this.#buffer.indexOf("\n");
      const line = this.#buffer.slice(0, newlineIndex);
      this.#buffer = this.#buffer.slice(newlineIndex + 1);

      if (line.trim().length > 0) {
        this.#handleMessage(JSON.parse(line) as JsonObject);
      }
    }
  }

  #handleMessage(message: JsonObject) {
    if (typeof message.id !== "number") {
      this.notifications.push(message);
      return;
    }

    this.requests.push(message);

    if (message.method === "initialize") {
      this.#write({ id: message.id, result: { codexHome: "/home/user/.codex" } });
      return;
    }

    if (message.method === "thread/start") {
      this.#write({ id: message.id, result: { thread: { id: this.#threadId } } });
      return;
    }

    if (message.method === "turn/start") {
      const params = message.params as JsonObject;
      this.#threadId = String(params.threadId);
      this.#write({ id: message.id, result: { turn: { id: "turn-1" } } });

      if (!this.completeTurns) {
        return;
      }

      setImmediate(() => {
        this.#write({
          method: "item/completed",
          params: {
            item: { id: "reasoning-1", type: "reasoning", summary: ["thinking"], content: [] },
            threadId: this.#threadId,
            turnId: "turn-1",
          },
        });
        if (this.emitItemCompleted) {
          this.#write({
            method: "item/completed",
            params: {
              item: this.completedAgentItem,
              threadId: this.#threadId,
              turnId: "turn-1",
            },
          });
        }
        this.#write({
          method: "turn/completed",
          params: {
            threadId: this.#threadId,
            turn: { id: "turn-1", items: [this.completedAgentItem], status: "completed" },
          },
        });
      });
    }
  }

  #write(message: JsonObject) {
    this.stdout.write(`${JSON.stringify(message)}\n`);
  }
}

describe("CodexAppServerPromptRunner", () => {
  it("starts app-server, creates a thread, and returns only the final answer", async () => {
    const fakeProcess = new FakeAppServerProcess();
    const spawned: Array<{ command: string; args: string[] }> = [];
    const runner = new CodexAppServerPromptRunner({
      spawnAppServer: (command, args) => {
        spawned.push({ command, args });
        return fakeProcess as never;
      },
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session-1", "こんにちは")).resolves.toBe("最終回答です。");

    expect(spawned).toEqual([{ command: "codex", args: ["app-server", "--listen", "stdio://"] }]);
    expect(fakeProcess.notifications).toEqual([{ method: "initialized" }]);
    expect(fakeProcess.requests.map((request) => request.method)).toEqual([
      "initialize",
      "thread/start",
      "turn/start",
    ]);
    expect(fakeProcess.requests.at(1)?.params).toMatchObject({
      cwd: "/repo",
      sessionStartSource: "startup",
    });
    expect(fakeProcess.requests.at(2)?.params).toMatchObject({
      cwd: "/repo",
      input: [{ text: "こんにちは", text_elements: [], type: "text" }],
      threadId: "thread-1",
    });
  });

  it("returns the final answer from turn completed items", async () => {
    const fakeProcess = new FakeAppServerProcess();
    fakeProcess.emitItemCompleted = false;
    fakeProcess.completedAgentItem = {
      id: "agent-1",
      phase: "final_answer",
      text: "turn payloadの最終回答です。",
      type: "agentMessage",
    };
    const runner = new CodexAppServerPromptRunner({
      spawnAppServer: () => fakeProcess as never,
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session-1", "こんにちは")).resolves.toBe(
      "turn payloadの最終回答です。",
    );
  });

  it("falls back to an unknown phase agent message after turn completion", async () => {
    const fakeProcess = new FakeAppServerProcess();
    fakeProcess.emitItemCompleted = false;
    fakeProcess.completedAgentItem = {
      id: "agent-1",
      text: "phaseなしの回答です。",
      type: "agentMessage",
    };
    const runner = new CodexAppServerPromptRunner({
      spawnAppServer: () => fakeProcess as never,
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session-1", "こんにちは")).resolves.toBe(
      "phaseなしの回答です。",
    );
  });

  it("extracts agent message text from content items", async () => {
    const fakeProcess = new FakeAppServerProcess();
    fakeProcess.emitItemCompleted = false;
    fakeProcess.completedAgentItem = {
      content: [{ text: "content由来の" }, { text: "回答です。" }],
      id: "agent-1",
      phase: "final_answer",
      type: "agentMessage",
    };
    const runner = new CodexAppServerPromptRunner({
      spawnAppServer: () => fakeProcess as never,
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session-1", "こんにちは")).resolves.toBe(
      "content由来の回答です。",
    );
  });

  it("reuses the same app-server thread for the same bridge session", async () => {
    const fakeProcess = new FakeAppServerProcess();
    const runner = new CodexAppServerPromptRunner({
      spawnAppServer: () => fakeProcess as never,
      workingDirectory: "/repo",
    });

    await runner.runPrompt("session-1", "first");
    await runner.runPrompt("session-1", "second");

    expect(fakeProcess.requests.map((request) => request.method)).toEqual([
      "initialize",
      "thread/start",
      "turn/start",
      "turn/start",
    ]);
  });

  it("fails instead of waiting forever when a turn does not complete", async () => {
    const fakeProcess = new FakeAppServerProcess();
    fakeProcess.completeTurns = false;
    const runner = new CodexAppServerPromptRunner({
      spawnAppServer: () => fakeProcess as never,
      turnTimeoutMs: 1,
      workingDirectory: "/repo",
    });

    await expect(runner.runPrompt("session-1", "needs approval")).rejects.toThrow(
      "Codex app-server turn did not complete within 1ms",
    );
  });
});
