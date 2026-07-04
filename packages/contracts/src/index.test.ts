import {
  bridgeHealthResponseSchema,
  createSessionResponseSchema,
  sendPromptRequestSchema,
  sendPromptResponseSchema,
  sessionMessagesResponseSchema,
} from "./index.js";

describe("bridgeHealthResponseSchema", () => {
  it("accepts the bridge health response contract", () => {
    expect(
      bridgeHealthResponseSchema.parse({
        status: "ok",
        service: "expo-sanpo-bridge",
      }),
    ).toEqual({
      status: "ok",
      service: "expo-sanpo-bridge",
    });
  });
});

describe("createSessionResponseSchema", () => {
  it("accepts a session creation response", () => {
    expect(
      createSessionResponseSchema.parse({
        session: {
          id: "session-1",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
      }),
    ).toEqual({
      session: {
        id: "session-1",
        createdAt: "2026-07-04T00:00:00.000Z",
      },
    });
  });
});

describe("sessionMessagesResponseSchema", () => {
  it("accepts a session messages response", () => {
    expect(
      sessionMessagesResponseSchema.parse({
        sessionId: "session-1",
        messages: [
          {
            id: "message-1",
            sessionId: "session-1",
            role: "system",
            content: "Session is ready.",
            createdAt: "2026-07-04T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      sessionId: "session-1",
      messages: [
        {
          id: "message-1",
          sessionId: "session-1",
          role: "system",
          content: "Session is ready.",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
      ],
    });
  });
});

describe("sendPromptRequestSchema", () => {
  it("accepts a prompt request", () => {
    expect(sendPromptRequestSchema.parse({ prompt: "Hello" })).toEqual({ prompt: "Hello" });
  });
});

describe("sendPromptResponseSchema", () => {
  it("accepts a prompt response", () => {
    expect(
      sendPromptResponseSchema.parse({
        sessionId: "session-1",
        messages: [
          {
            id: "message-1",
            sessionId: "session-1",
            role: "user",
            content: "Hello",
            createdAt: "2026-07-04T00:00:00.000Z",
          },
          {
            id: "message-2",
            sessionId: "session-1",
            role: "assistant",
            content: "Mock response: Hello",
            createdAt: "2026-07-04T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      sessionId: "session-1",
      messages: [
        {
          id: "message-1",
          sessionId: "session-1",
          role: "user",
          content: "Hello",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
        {
          id: "message-2",
          sessionId: "session-1",
          role: "assistant",
          content: "Mock response: Hello",
          createdAt: "2026-07-04T00:00:00.000Z",
        },
      ],
    });
  });
});
