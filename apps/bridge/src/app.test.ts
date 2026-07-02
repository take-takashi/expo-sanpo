import { bridgeHealthResponseSchema } from "@expo-sanpo/contracts";

import { app } from "./app.js";

describe("bridge app", () => {
  it("returns a valid health response", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(bridgeHealthResponseSchema.parse(await response.json())).toEqual({
      status: "ok",
      service: "expo-sanpo-bridge",
    });
  });
});
