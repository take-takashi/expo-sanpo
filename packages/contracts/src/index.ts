import { z } from "zod";

export const bridgeHealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("expo-sanpo-bridge"),
});

export type BridgeHealthResponse = z.infer<typeof bridgeHealthResponseSchema>;
