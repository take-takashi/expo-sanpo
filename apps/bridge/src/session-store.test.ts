import { SessionStore } from "./session-store.js";

describe("SessionStore", () => {
  it("lists created sessions", () => {
    const store = new SessionStore();
    const first = store.createSession();
    const second = store.createSession();

    expect(store.listSessions()).toEqual({
      sessions: [first.session, second.session],
    });
  });

  it("creates a session with an initial message", () => {
    const store = new SessionStore();
    const response = store.createSession();

    expect(response.session.id).toEqual(expect.any(String));
    expect(response.session).toMatchObject({
      id: expect.any(String),
      name: expect.stringMatching(/^Session \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
      createdAt: expect.any(String),
      updatedAt: response.session.createdAt,
      latestMessageSummary: "Session is ready. tmux integration is not connected yet.",
    });

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

  it("updates a session name", () => {
    const store = new SessionStore();
    const created = store.createSession();

    expect(store.updateSessionName(created.session.id, "散歩メモ")).toEqual({
      session: {
        ...created.session,
        name: "散歩メモ",
      },
    });
    expect(store.listSessions().sessions[0]?.name).toBe("散歩メモ");
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
    expect(store.listSessions().sessions[0]).toMatchObject({
      id: created.session.id,
      updatedAt: response?.messages.at(2)?.createdAt,
      latestMessageSummary: "Mock response: Hello Codex",
    });
  });

  it("returns null for unknown sessions", async () => {
    const store = new SessionStore();

    expect(store.getMessages("missing-session")).toBeNull();
    expect(store.updateSessionName("missing-session", "Name")).toBeNull();
    await expect(store.sendPrompt("missing-session", "Hello")).resolves.toBeNull();
  });
});
