import { SessionStore } from "./session-store.js";

describe("SessionStore", () => {
  it("creates a session with an initial message", () => {
    const store = new SessionStore();
    const response = store.createSession();

    expect(response.session.id).toEqual(expect.any(String));
    expect(response.session.createdAt).toEqual(expect.any(String));

    const messages = store.getMessages(response.session.id);
    expect(messages).toEqual({
      sessionId: response.session.id,
      messages: [
        {
          id: expect.any(String),
          sessionId: response.session.id,
          role: "system",
          content: "Session is ready. tmux integration is not connected yet.",
          createdAt: response.session.createdAt,
        },
      ],
    });
  });

  it("stores a user prompt with a mock assistant response", async () => {
    const store = new SessionStore();
    const created = store.createSession();
    const response = await store.sendPrompt(created.session.id, "Hello Codex");

    expect(response?.messages).toHaveLength(3);
    expect(response?.messages.at(1)).toMatchObject({
      sessionId: created.session.id,
      role: "user",
      content: "Hello Codex",
    });
    expect(response?.messages.at(2)).toMatchObject({
      sessionId: created.session.id,
      role: "assistant",
      content: "Mock response: Hello Codex",
    });
  });

  it("returns null for unknown sessions", async () => {
    const store = new SessionStore();

    expect(store.getMessages("missing-session")).toBeNull();
    await expect(store.sendPrompt("missing-session", "Hello")).resolves.toBeNull();
  });
});
