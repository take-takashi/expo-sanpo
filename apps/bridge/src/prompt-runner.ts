export interface PromptRunner {
  getReadyMessage(): string;
  runPrompt(sessionId: string, prompt: string): Promise<string>;
}

export class MockPromptRunner implements PromptRunner {
  getReadyMessage() {
    return "Session is ready. tmux integration is not connected yet.";
  }

  async runPrompt(_sessionId: string, prompt: string) {
    return `Mock response: ${prompt}`;
  }
}
