import { bridgeHealthResponseSchema } from "@expo-sanpo/contracts";
import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (context) => {
  const response = bridgeHealthResponseSchema.parse({
    status: "ok",
    service: "expo-sanpo-bridge",
  });

  return context.json(response);
});
