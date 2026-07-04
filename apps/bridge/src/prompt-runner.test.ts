import { MockPromptRunner } from "./prompt-runner.js";

describe("MockPromptRunner", () => {
  it("returns a mock response", async () => {
    const runner = new MockPromptRunner();

    await expect(runner.runPrompt("session-1", "Hello")).resolves.toBe("Mock response: Hello");
  });
});
