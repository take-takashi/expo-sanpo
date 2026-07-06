import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

import type { PromptRunner } from "./prompt-runner.js";

type JsonObject = Record<string, unknown>;
type SpawnAppServer = (command: string, args: string[]) => ChildProcessWithoutNullStreams;

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
};

type AppServerNotification = {
  method: string;
  params?: unknown;
};

type AppServerClientOptions = {
  codexCommand?: string;
  spawnAppServer?: SpawnAppServer;
  turnTimeoutMs?: number;
};

const defaultTurnTimeoutMs = 10 * 60 * 1000;

const defaultSpawnAppServer: SpawnAppServer = (command, args) => spawnProcess(command, args);

function spawnProcess(command: string, args: string[]) {
  return nodeSpawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
}

export class CodexAppServerPromptRunner implements PromptRunner {
  readonly #client: CodexAppServerClient;
  readonly #sessionThreads = new Map<string, string>();
  readonly #workingDirectory: string;

  constructor({
    client,
    codexCommand = "codex",
    spawnAppServer = defaultSpawnAppServer,
    turnTimeoutMs = defaultTurnTimeoutMs,
    workingDirectory = process.cwd(),
  }: {
    client?: CodexAppServerClient;
    codexCommand?: string;
    spawnAppServer?: SpawnAppServer;
    turnTimeoutMs?: number;
    workingDirectory?: string;
  } = {}) {
    this.#client =
      client ?? new CodexAppServerClient({ codexCommand, spawnAppServer, turnTimeoutMs });
    this.#workingDirectory = workingDirectory;
  }

  getReadyMessage() {
    return "Session is ready. Codex app-server will be started on first prompt.";
  }

  async runPrompt(sessionId: string, prompt: string) {
    await this.#client.initialize();
    const threadId = await this.#getOrCreateThread(sessionId);

    return this.#client.runTurn({
      cwd: this.#workingDirectory,
      prompt,
      threadId,
    });
  }

  async #getOrCreateThread(sessionId: string) {
    const existingThreadId = this.#sessionThreads.get(sessionId);

    if (existingThreadId) {
      return existingThreadId;
    }

    const threadId = await this.#client.startThread({ cwd: this.#workingDirectory });
    this.#sessionThreads.set(sessionId, threadId);

    return threadId;
  }
}

export class CodexAppServerClient {
  readonly #codexCommand: string;
  readonly #spawnAppServer: SpawnAppServer;
  readonly #turnTimeoutMs: number;
  readonly #events = new EventEmitter();
  readonly #pendingRequests = new Map<number, PendingRequest>();
  #nextRequestId = 1;
  #process: ChildProcessWithoutNullStreams | null = null;
  #initializePromise: Promise<void> | null = null;

  constructor({
    codexCommand = "codex",
    spawnAppServer = defaultSpawnAppServer,
    turnTimeoutMs = defaultTurnTimeoutMs,
  }: AppServerClientOptions = {}) {
    this.#codexCommand = codexCommand;
    this.#spawnAppServer = spawnAppServer;
    this.#turnTimeoutMs = turnTimeoutMs;
  }

  async initialize() {
    if (this.#initializePromise) {
      return this.#initializePromise;
    }

    this.#initializePromise = this.#initialize();

    return this.#initializePromise;
  }

  async startThread({ cwd }: { cwd: string }) {
    const response = await this.#sendRequest("thread/start", {
      cwd,
      sessionStartSource: "startup",
    });
    const threadId = getNestedString(response, ["thread", "id"]);

    if (!threadId) {
      throw new Error("Codex app-server thread/start response did not include thread.id");
    }

    return threadId;
  }

  async runTurn({ cwd, prompt, threadId }: { cwd: string; prompt: string; threadId: string }) {
    const turn = new AppServerTurnCollector(threadId);
    const unsubscribe = this.#subscribe((notification) => {
      turn.handleNotification(notification);
    });

    try {
      await this.#sendRequest("turn/start", {
        cwd,
        input: [{ text: prompt, text_elements: [], type: "text" }],
        threadId,
      });

      return await turn.waitForFinalAnswer(this.#turnTimeoutMs);
    } finally {
      unsubscribe();
    }
  }

  async #initialize() {
    this.#startProcess();
    await this.#sendRequest("initialize", {
      capabilities: {
        experimentalApi: true,
      },
      clientInfo: {
        name: "expo-sanpo-bridge",
        version: "0.1.0",
      },
    });
    this.#sendNotification("initialized");
  }

  #startProcess() {
    if (this.#process) {
      return;
    }

    const childProcess = this.#spawnAppServer(this.#codexCommand, [
      "app-server",
      "--listen",
      "stdio://",
    ]);
    this.#process = childProcess;

    createInterface({ input: childProcess.stdout }).on("line", (line) => {
      this.#handleLine(line);
    });

    childProcess.stderr.on("data", () => {
      // Codex app-server can print non-protocol warnings to stderr. Keep them out of API responses.
    });

    childProcess.on("exit", (code, signal) => {
      const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      this.#rejectAll(new Error(`Codex app-server exited with ${reason}`));
      this.#process = null;
      this.#initializePromise = null;
    });

    childProcess.on("error", (error) => {
      this.#rejectAll(error);
      this.#process = null;
      this.#initializePromise = null;
    });
  }

  #sendRequest(method: string, params: JsonObject) {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;

    const process = this.#process;

    if (!process) {
      return Promise.reject(new Error("Codex app-server process is not running"));
    }

    const request = { id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      this.#pendingRequests.set(id, { reject, resolve });
      process.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  #sendNotification(method: string, params?: JsonObject) {
    const process = this.#process;

    if (!process) {
      throw new Error("Codex app-server process is not running");
    }

    process.stdin.write(`${JSON.stringify(params ? { method, params } : { method })}\n`);
  }

  #handleLine(line: string) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    const message = JSON.parse(trimmedLine) as JsonObject;
    const id = typeof message.id === "number" ? message.id : null;

    if (typeof message.method === "string") {
      this.#events.emit("notification", message as AppServerNotification);
      return;
    }

    if (id !== null) {
      this.#handleResponse(id, message);
      return;
    }
  }

  #handleResponse(id: number, response: JsonObject) {
    const pendingRequest = this.#pendingRequests.get(id);

    if (!pendingRequest) {
      return;
    }

    this.#pendingRequests.delete(id);

    if (response.error) {
      pendingRequest.reject(new Error(formatAppServerError(response.error)));
      return;
    }

    pendingRequest.resolve(response.result);
  }

  #subscribe(listener: (notification: AppServerNotification) => void) {
    this.#events.on("notification", listener);

    return () => {
      this.#events.off("notification", listener);
    };
  }

  #rejectAll(error: Error) {
    for (const pendingRequest of this.#pendingRequests.values()) {
      pendingRequest.reject(error);
    }

    this.#pendingRequests.clear();
  }
}

class AppServerTurnCollector {
  readonly #threadId: string;
  readonly #finalAnswers: string[] = [];
  readonly #unknownAgentMessages: string[] = [];
  #isCompleted = false;
  #resolve: ((answer: string) => void) | null = null;

  constructor(threadId: string) {
    this.#threadId = threadId;
  }

  handleNotification(notification: AppServerNotification) {
    if (!isObject(notification.params)) {
      return;
    }

    const threadId = getString(notification.params, "threadId");

    if (threadId !== this.#threadId) {
      return;
    }

    if (notification.method === "item/completed") {
      this.#handleCompletedItem(notification.params);
      return;
    }

    if (notification.method === "turn/completed") {
      this.#isCompleted = true;
      this.#completeIfReady();
    }
  }

  waitForFinalAnswer(timeoutMs: number) {
    if (this.#isCompleted) {
      return Promise.resolve(this.#getAnswer());
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#resolve = null;
        reject(new Error(`Codex app-server turn did not complete within ${timeoutMs}ms`));
      }, timeoutMs);

      this.#resolve = (answer) => {
        clearTimeout(timeout);
        resolve(answer);
      };
      this.#completeIfReady();
    });
  }

  #handleCompletedItem(params: JsonObject) {
    const item = params.item;

    if (!isObject(item) || item.type !== "agentMessage") {
      return;
    }

    const text = getString(item, "text")?.trim();

    if (!text) {
      return;
    }

    if (item.phase === "final_answer") {
      this.#finalAnswers.push(text);
      return;
    }

    if (item.phase === null || item.phase === undefined) {
      this.#unknownAgentMessages.push(text);
    }
  }

  #completeIfReady() {
    if (!this.#isCompleted || !this.#resolve) {
      return;
    }

    this.#resolve(this.#getAnswer());
    this.#resolve = null;
  }

  #getAnswer() {
    const answer = this.#finalAnswers.at(-1) ?? this.#unknownAgentMessages.at(-1);

    return answer ?? "Codex app-server turn completed without a final answer.";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(object: JsonObject, key: string) {
  const value = object[key];

  return typeof value === "string" ? value : undefined;
}

function getNestedString(value: unknown, keys: string[]) {
  let current = value;

  for (const key of keys) {
    if (!isObject(current)) {
      return undefined;
    }

    current = current[key];
  }

  return typeof current === "string" ? current : undefined;
}

function formatAppServerError(error: unknown) {
  if (!isObject(error)) {
    return "Codex app-server request failed";
  }

  const message = getString(error, "message");

  if (message) {
    return message;
  }

  return JSON.stringify(error);
}
