import { randomUUID } from "node:crypto";
import {
  type Message,
  type Session,
  createSessionResponseSchema,
  sendPromptResponseSchema,
  sessionMessagesResponseSchema,
} from "@expo-sanpo/contracts";

export class SessionStore {
  readonly #sessions = new Map<string, Session>();
  readonly #messages = new Map<string, Message[]>();

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
        content: "Session is ready. tmux integration is not connected yet.",
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

  sendPrompt(sessionId: string, prompt: string) {
    const messages = this.#messages.get(sessionId);

    if (!messages) {
      return null;
    }

    const createdAt = new Date().toISOString();
    messages.push(
      {
        id: randomUUID(),
        sessionId,
        role: "user",
        content: prompt,
        createdAt,
      },
      {
        id: randomUUID(),
        sessionId,
        role: "assistant",
        content: `Mock response: ${prompt}`,
        createdAt,
      },
    );

    return sendPromptResponseSchema.parse({
      sessionId,
      messages,
    });
  }
}
