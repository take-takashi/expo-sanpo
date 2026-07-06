import { CodexAppServerPromptRunner } from "./codex-app-server-prompt-runner.js";
import { CodexPromptRunner } from "./codex-prompt-runner.js";
import { MockPromptRunner } from "./prompt-runner.js";
import { createPromptRunnerFromEnv } from "./prompt-runner-factory.js";
import { TmuxPromptRunner } from "./tmux-prompt-runner.js";

describe("createPromptRunnerFromEnv", () => {
  it("uses the mock runner by default", () => {
    expect(createPromptRunnerFromEnv({})).toBeInstanceOf(MockPromptRunner);
  });

  it("uses the codex app-server runner when requested", () => {
    expect(
      createPromptRunnerFromEnv({ EXPO_SANPO_PROMPT_DRIVER: "codex-app-server" }),
    ).toBeInstanceOf(CodexAppServerPromptRunner);
  });

  it("accepts a custom codex app-server turn timeout", () => {
    expect(
      createPromptRunnerFromEnv({
        EXPO_SANPO_CODEX_APP_SERVER_TURN_TIMEOUT_MS: "12345",
        EXPO_SANPO_PROMPT_DRIVER: "codex-app-server",
      }),
    ).toBeInstanceOf(CodexAppServerPromptRunner);
  });

  it("uses the codex runner when requested", () => {
    expect(createPromptRunnerFromEnv({ EXPO_SANPO_PROMPT_DRIVER: "codex" })).toBeInstanceOf(
      CodexPromptRunner,
    );
  });

  it("uses the tmux runner when requested", () => {
    expect(createPromptRunnerFromEnv({ EXPO_SANPO_PROMPT_DRIVER: "tmux" })).toBeInstanceOf(
      TmuxPromptRunner,
    );
  });
});
