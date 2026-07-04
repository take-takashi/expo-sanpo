import {
  bridgeHealthResponseSchema,
  createSessionResponseSchema,
  sessionMessagesResponseSchema,
} from "@expo-sanpo/contracts";

import { createApp } from "./app.js";

describe("bridge app", () => {
  it("returns a valid health response", async () => {
    const app = createApp();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(bridgeHealthResponseSchema.parse(await response.json())).toEqual({
      status: "ok",
      service: "expo-sanpo-bridge",
    });
  });

  it("creates a session and returns its messages", async () => {
    const app = createApp();
    const createResponse = await app.request("/sessions", {
      method: "POST",
    });

    expect(createResponse.status).toBe(201);
    const created = createSessionResponseSchema.parse(await createResponse.json());

    const messagesResponse = await app.request(`/sessions/${created.session.id}/messages`);

    expect(messagesResponse.status).toBe(200);
    const messages = sessionMessagesResponseSchema.parse(await messagesResponse.json());
    expect(messages.sessionId).toBe(created.session.id);
    expect(messages.messages).toHaveLength(1);
    expect(messages.messages[0]).toMatchObject({
      sessionId: created.session.id,
      role: "system",
      content: "Session is ready. tmux integration is not connected yet.",
    });
  });

  it("returns 404 for missing session messages", async () => {
    const app = createApp();
    const response = await app.request("/sessions/missing-session/messages");

    expect(response.status).toBe(404);
  });
});
