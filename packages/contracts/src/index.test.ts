import {
  bridgeHealthResponseSchema,
  createSessionResponseSchema,
  listSessionsResponseSchema,
  sendPromptRequestSchema,
  sendPromptResponseSchema,
  sessionMessagesResponseSchema,
  updateSessionRequestSchema,
  updateSessionResponseSchema,
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

describe("listSessionsResponseSchema", () => {
  it("accepts a sessions list response", () => {
    expect(
      listSessionsResponseSchema.parse({
        sessions: [
          {
            id: "session-1",
            name: "Session 2026-07-04 00:00:00",
            createdAt: "2026-07-04T00:00:00.000Z",
            updatedAt: "2026-07-04T00:01:00.000Z",
            latestMessageSummary: "Latest assistant response.",
          },
        ],
      }),
    ).toEqual({
      sessions: [
        {
          id: "session-1",
          name: "Session 2026-07-04 00:00:00",
          createdAt: "2026-07-04T00:00:00.000Z",
          updatedAt: "2026-07-04T00:01:00.000Z",
          latestMessageSummary: "Latest assistant response.",
        },
      ],
    });
  });
});

describe("createSessionResponseSchema", () => {
  it("accepts a session creation response", () => {
    expect(
      createSessionResponseSchema.parse({
        session: {
          id: "session-1",
          name: "Session 2026-07-04 00:00:00",
          createdAt: "2026-07-04T00:00:00.000Z",
          updatedAt: "2026-07-04T00:01:00.000Z",
          latestMessageSummary: "Latest assistant response.",
        },
      }),
    ).toEqual({
      session: {
        id: "session-1",
        name: "Session 2026-07-04 00:00:00",
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:01:00.000Z",
        latestMessageSummary: "Latest assistant response.",
      },
    });
  });
});

describe("updateSessionRequestSchema", () => {
  it("accepts a session name update request", () => {
    expect(updateSessionRequestSchema.parse({ name: "散歩メモ" })).toEqual({
      name: "散歩メモ",
    });
  });
});

describe("updateSessionResponseSchema", () => {
  it("accepts a session update response", () => {
    expect(
      updateSessionResponseSchema.parse({
        session: {
          id: "session-1",
          name: "散歩メモ",
          createdAt: "2026-07-04T00:00:00.000Z",
          updatedAt: "2026-07-04T00:01:00.000Z",
          latestMessageSummary: "Latest assistant response.",
        },
      }),
    ).toEqual({
      session: {
        id: "session-1",
        name: "散歩メモ",
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:01:00.000Z",
        latestMessageSummary: "Latest assistant response.",
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
