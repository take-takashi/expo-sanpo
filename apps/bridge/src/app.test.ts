import {
  bridgeHealthResponseSchema,
  createSessionResponseSchema,
  sendPromptResponseSchema,
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

  it("stores a prompt and returns updated messages", async () => {
    const app = createApp();
    const createResponse = await app.request("/sessions", {
      method: "POST",
    });
    const created = createSessionResponseSchema.parse(await createResponse.json());

    const promptResponse = await app.request(`/sessions/${created.session.id}/prompts`, {
      body: JSON.stringify({ prompt: "Hello Codex" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(promptResponse.status).toBe(201);
    const result = sendPromptResponseSchema.parse(await promptResponse.json());
    expect(result.sessionId).toBe(created.session.id);
    expect(result.messages).toHaveLength(3);
    expect(result.messages.at(1)).toMatchObject({
      role: "user",
      content: "Hello Codex",
    });
    expect(result.messages.at(2)).toMatchObject({
      role: "assistant",
      content: "Mock response: Hello Codex",
    });
  });

  it("returns 400 for invalid prompt requests", async () => {
    const app = createApp();
    const createResponse = await app.request("/sessions", {
      method: "POST",
    });
    const created = createSessionResponseSchema.parse(await createResponse.json());

    const response = await app.request(`/sessions/${created.session.id}/prompts`, {
      body: JSON.stringify({ prompt: "" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 for missing prompt sessions", async () => {
    const app = createApp();
    const response = await app.request("/sessions/missing-session/prompts", {
      body: JSON.stringify({ prompt: "Hello" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for missing session messages", async () => {
    const app = createApp();
    const response = await app.request("/sessions/missing-session/messages");

    expect(response.status).toBe(404);
  });
});
