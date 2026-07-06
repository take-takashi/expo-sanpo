import { z } from "zod";

export const bridgeHealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("expo-sanpo-bridge"),
});

export type BridgeHealthResponse = z.infer<typeof bridgeHealthResponseSchema>;

export const sessionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  latestMessageSummary: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;

export const listSessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema),
});

export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>;

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

export const updateSessionRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type UpdateSessionRequest = z.infer<typeof updateSessionRequestSchema>;

export const updateSessionResponseSchema = z.object({
  session: sessionSchema,
});

export type UpdateSessionResponse = z.infer<typeof updateSessionResponseSchema>;

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
