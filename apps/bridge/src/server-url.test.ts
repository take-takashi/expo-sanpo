import { getBridgeServerUrls } from "./server-url.js";

describe("getBridgeServerUrls", () => {
  it("always includes the localhost URL", () => {
    expect(getBridgeServerUrls(8787)).toContain("http://localhost:8787");
  });
});
