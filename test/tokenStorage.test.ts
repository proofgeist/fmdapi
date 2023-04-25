import { DataApi } from "../src";
import { upstashTokenStore } from "../src/tokenStore";

describe("TokenStorage", () => {
  it("should allow passing upstash to client init", () => {
    DataApi({
      auth: { username: "username", password: "password" },
      db: "db",
      server: "https://example.com",
      tokenStore: upstashTokenStore({ token: "token", url: "url" }),
    });
  });
  it("shoulw not require a token store", () => {
    DataApi({
      auth: { username: "username", password: "password" },
      db: "db",
      server: "https://example.com",
    });
  });
});
