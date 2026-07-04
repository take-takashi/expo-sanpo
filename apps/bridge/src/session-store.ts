import { randomUUID } from "node:crypto";
import {
  type Message,
  type Session,
  createSessionResponseSchema,
  sendPromptResponseSchema,
  sessionMessagesResponseSchema,
} from "@expo-sanpo/contracts";

import { MockPromptRunner, type PromptRunner } from "./prompt-runner.js";

export class SessionStore {
  readonly #messages = new Map<string, Message[]>();
  readonly #promptRunner: PromptRunner;
  readonly #sessions = new Map<string, Session>();

  constructor(promptRunner: PromptRunner = new MockPromptRunner()) {
    this.#promptRunner = promptRunner;
  }

  createSession() {
    const createdAt = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      createdAt,
    };
    const messages: Message[] = [
      {
        id: randomUUID(),
        sessionId: session.id,
        role: "system",
        content: this.#promptRunner.getReadyMessage(),
        createdAt,
      },
    ];

    this.#sessions.set(session.id, session);
    this.#messages.set(session.id, messages);

    return createSessionResponseSchema.parse({ session });
  }

  getMessages(sessionId: string) {
    const messages = this.#messages.get(sessionId);

    if (!messages) {
      return null;
    }

    return sessionMessagesResponseSchema.parse({
      sessionId,
      messages,
    });
  }

  async sendPrompt(sessionId: string, prompt: string) {
    const messages = this.#messages.get(sessionId);

    if (!messages) {
      return null;
    }

    const userMessageCreatedAt = new Date().toISOString();
    messages.push({
      id: randomUUID(),
      sessionId,
      role: "user",
      content: prompt,
      createdAt: userMessageCreatedAt,
    });

    const assistantContent = await this.#promptRunner.runPrompt(sessionId, prompt);
    messages.push({
      id: randomUUID(),
      sessionId,
      role: "assistant",
      content: assistantContent,
      createdAt: new Date().toISOString(),
    });

    return sendPromptResponseSchema.parse({
      sessionId,
      messages,
    });
  }
}
