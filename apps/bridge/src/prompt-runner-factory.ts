import { CodexAppServerPromptRunner } from "./codex-app-server-prompt-runner.js";
import { CodexPromptRunner } from "./codex-prompt-runner.js";
import { MockPromptRunner, type PromptRunner } from "./prompt-runner.js";
import { TmuxPromptRunner } from "./tmux-prompt-runner.js";

export function createPromptRunnerFromEnv(env: NodeJS.ProcessEnv = process.env): PromptRunner {
  if (env.EXPO_SANPO_PROMPT_DRIVER === "codex-app-server") {
    const turnTimeoutMs = parsePositiveInteger(env.EXPO_SANPO_CODEX_APP_SERVER_TURN_TIMEOUT_MS);

    return new CodexAppServerPromptRunner({
      codexCommand: env.EXPO_SANPO_CODEX_COMMAND ?? "codex",
      ...(turnTimeoutMs ? { turnTimeoutMs } : {}),
      workingDirectory: env.EXPO_SANPO_CODEX_WORKDIR ?? env.INIT_CWD ?? process.cwd(),
    });
  }

  if (env.EXPO_SANPO_PROMPT_DRIVER === "codex") {
    return new CodexPromptRunner({
      codexCommand: env.EXPO_SANPO_CODEX_COMMAND ?? "codex",
      sessionPrefix: env.EXPO_SANPO_TMUX_SESSION_PREFIX ?? "expo-sanpo-codex",
      submitKeys: parseSubmitKeys(env.EXPO_SANPO_CODEX_SUBMIT_KEYS),
      workingDirectory: env.EXPO_SANPO_CODEX_WORKDIR ?? env.INIT_CWD ?? process.cwd(),
    });
  }

  if (env.EXPO_SANPO_PROMPT_DRIVER === "tmux") {
    return new TmuxPromptRunner({
      sessionPrefix: env.EXPO_SANPO_TMUX_SESSION_PREFIX ?? "expo-sanpo",
    });
  }

  return new MockPromptRunner();
}

function parseSubmitKeys(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const keys = value
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  return keys.length > 0 ? keys : undefined;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
