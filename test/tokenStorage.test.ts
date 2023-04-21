import { DataApi } from "../src";
import { localStorageStore, upstashTokenStore } from "../src/tokenStore";

describe("TokenStorage", () => {
  it("should allow passing localStorage to client init", () => {
    DataApi({
      auth: { username: "username", password: "password" },
      db: "db",
      server: "https://example.com",
      tokenStore: localStorageStore(),
    });
  });
  it("should allow passing upstash to client init", () => {
    DataApi({
      auth: { username: "username", password: "password" },
      db: "db",
      server: "https://example.com",
      tokenStore: upstashTokenStore({ token: "token", url: "url" }),
    });
  });
});
