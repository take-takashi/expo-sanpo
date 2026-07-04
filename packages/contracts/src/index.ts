import { z } from "zod";

export const bridgeHealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("expo-sanpo-bridge"),
});

export type BridgeHealthResponse = z.infer<typeof bridgeHealthResponseSchema>;

export const sessionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
});

export type Session = z.infer<typeof sessionSchema>;

export const messageRoleSchema = z.enum(["system", "user", "assistant"]);

export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.string().min(1),
});

export type Message = z.infer<typeof messageSchema>;

export const createSessionResponseSchema = z.object({
  session: sessionSchema,
});

export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;

export const sessionMessagesResponseSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(messageSchema),
});

export type SessionMessagesResponse = z.infer<typeof sessionMessagesResponseSchema>;

export const sendPromptRequestSchema = z.object({
  prompt: z.string().min(1),
});

export type SendPromptRequest = z.infer<typeof sendPromptRequestSchema>;

export const sendPromptResponseSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(messageSchema),
});

export type SendPromptResponse = z.infer<typeof sendPromptResponseSchema>;
