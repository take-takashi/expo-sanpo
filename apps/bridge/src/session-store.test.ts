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

  it("returns null for unknown sessions", () => {
    const store = new SessionStore();

    expect(store.getMessages("missing-session")).toBeNull();
  });
});
