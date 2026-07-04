import { bridgeHealthResponseSchema } from "@expo-sanpo/contracts";
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

  app.post("/sessions", (context) => {
    const response = sessionStore.createSession();

    return context.json(response, 201);
  });

  app.get("/sessions/:id/messages", (context) => {
    const response = sessionStore.getMessages(context.req.param("id"));

    if (!response) {
      return context.json({ error: "Session not found" }, 404);
    }

    return context.json(response);
  });

  return app;
}

export const app = createApp();
