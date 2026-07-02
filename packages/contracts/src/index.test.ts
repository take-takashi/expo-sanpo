import { bridgeHealthResponseSchema } from "./index.js";

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
