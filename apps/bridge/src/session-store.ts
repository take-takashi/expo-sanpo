import { randomUUID } from "node:crypto";
import {
  type Message,
  type Session,
  createSessionResponseSchema,
  listSessionsResponseSchema,
  sendPromptResponseSchema,
  updateSessionResponseSchema,
  sessionMessagesResponseSchema,
} from "@expo-sanpo/contracts";

import { MockPromptRunner, type PromptRunner } from "./prompt-runner.js";

function summarizeMessage(content: string) {
  const summary = content.replace(/\s+/g, " ").trim();

  if (summary.length <= 80) {
    return summary;
  }

  return `${summary.slice(0, 79)}...`;
}

function createSessionName(createdAt: string) {
  return `Session ${createdAt.slice(0, 19).replace("T", " ")}`;
}

export class SessionStore {
  readonly #messages = new Map<string, Message[]>();
  readonly #promptRunner: PromptRunner;
  readonly #sessions = new Map<string, Session>();

  constructor(promptRunner: PromptRunner = new MockPromptRunner()) {
    this.#promptRunner = promptRunner;
  }

  listSessions() {
    return listSessionsResponseSchema.parse({
      sessions: Array.from(this.#sessions.values()),
    });
  }

  createSession() {
    const createdAt = new Date().toISOString();
    const readyMessage = this.#promptRunner.getReadyMessage();
    const session: Session = {
      id: randomUUID(),
      name: createSessionName(createdAt),
      createdAt,
      updatedAt: createdAt,
      latestMessageSummary: summarizeMessage(readyMessage),
    };
    const messages: Message[] = [
      {
        id: randomUUID(),
        sessionId: session.id,
        role: "system",
        content: readyMessage,
        createdAt,
      },
    ];

    this.#sessions.set(session.id, session);
    this.#messages.set(session.id, messages);

    return createSessionResponseSchema.parse({ session });
  }

  updateSessionName(sessionId: string, name: string) {
    const session = this.#sessions.get(sessionId);

    if (!session) {
      return null;
    }

    const updatedSession: Session = {
      ...session,
      name: name.trim(),
    };
    this.#sessions.set(sessionId, updatedSession);

    return updateSessionResponseSchema.parse({ session: updatedSession });
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
    const assistantMessageCreatedAt = new Date().toISOString();
    messages.push({
      id: randomUUID(),
      sessionId,
      role: "assistant",
      content: assistantContent,
      createdAt: assistantMessageCreatedAt,
    });

    const session = this.#sessions.get(sessionId);

    if (session) {
      this.#sessions.set(sessionId, {
        ...session,
        updatedAt: assistantMessageCreatedAt,
        latestMessageSummary: summarizeMessage(assistantContent),
      });
    }

    return sendPromptResponseSchema.parse({
      sessionId,
      messages,
    });
  }
}
