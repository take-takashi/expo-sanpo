import {
  bridgeHealthResponseSchema,
  sendPromptRequestSchema,
  updateSessionRequestSchema,
} from "@expo-sanpo/contracts";
import { Hono } from "hono";

import { SessionStore } from "./session-store.js";

export function createApp(sessionStore = new SessionStore()) {
  const app = new Hono();

  app.get("/health", (context) => {
    const response = bridgeHealthResponseSchema.parse({
      status: "ok",
      service: "expo-sanpo-bridge",
    });

    return context.json(response);
  });

  app.get("/sessions", (context) => {
    return context.json(sessionStore.listSessions());
  });

  app.post("/sessions", (context) => {
    const response = sessionStore.createSession();

    return context.json(response, 201);
  });

  app.patch("/sessions/:id", async (context) => {
    const request = updateSessionRequestSchema.safeParse(
      await context.req.json().catch(() => null),
    );

    if (!request.success) {
      return context.json({ error: "Invalid session update request" }, 400);
    }

    const response = sessionStore.updateSessionName(context.req.param("id"), request.data.name);

    if (!response) {
      return context.json({ error: "Session not found" }, 404);
    }

    return context.json(response);
  });

  app.get("/sessions/:id/messages", (context) => {
    const response = sessionStore.getMessages(context.req.param("id"));

    if (!response) {
      return context.json({ error: "Session not found" }, 404);
    }

    return context.json(response);
  });

  app.post("/sessions/:id/prompts", async (context) => {
    const request = sendPromptRequestSchema.safeParse(await context.req.json().catch(() => null));

    if (!request.success) {
      return context.json({ error: "Invalid prompt request" }, 400);
    }

    const response = await sessionStore.sendPrompt(context.req.param("id"), request.data.prompt);

    if (!response) {
      return context.json({ error: "Session not found" }, 404);
    }

    return context.json(response, 201);
  });

  return app;
}

export const app = createApp();
