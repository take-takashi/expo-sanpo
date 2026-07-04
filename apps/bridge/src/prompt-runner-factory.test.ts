import { MockPromptRunner } from "./prompt-runner.js";
import { createPromptRunnerFromEnv } from "./prompt-runner-factory.js";
import { TmuxPromptRunner } from "./tmux-prompt-runner.js";

describe("createPromptRunnerFromEnv", () => {
  it("uses the mock runner by default", () => {
    expect(createPromptRunnerFromEnv({})).toBeInstanceOf(MockPromptRunner);
  });

  it("uses the tmux runner when requested", () => {
    expect(createPromptRunnerFromEnv({ EXPO_SANPO_PROMPT_DRIVER: "tmux" })).toBeInstanceOf(
      TmuxPromptRunner,
    );
  });
});
