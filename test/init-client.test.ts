import { DataApi } from "../src";

describe("try to init client", () => {
  test("without server", () => {
    expect(() =>
      DataApi({
        auth: { apiKey: "anything" },
        db: "anything",
        // @ts-expect-error
        server: "",
      })
    ).toThrow();
  });
  test("without https", () => {
    expect(() =>
      DataApi({
        auth: { apiKey: "anything" },
        db: "anything",
        server: "http://example.com",
      })
    ).not.toThrow();
  });
  test("without db", () => {
    expect(() =>
      DataApi({
        auth: { apiKey: "anything" },
        db: "",
        server: "https://example.com",
      })
    ).toThrow();
  });
  test("without auth", () => {
    expect(() =>
      DataApi({
        // @ts-expect-error
        auth: {},
        db: "anything",
        server: "https://example.com",
      })
    ).toThrow();
  });

  test("without password", () => {
    expect(() =>
      DataApi({
        auth: { username: "anything", password: "" },
        db: "anything",
        server: "https://example.com",
      })
    ).toThrow();
  });
  test("without username", () => {
    expect(() =>
      DataApi({
        auth: { username: "", password: "anything" },
        db: "anything",
        server: "https://example.com",
      })
    ).toThrow();
  });
  test("without apiKey", () => {
    expect(() =>
      DataApi({
        auth: { apiKey: "" },
        db: "anything",
        server: "https://example.com",
      })
    ).toThrow();
  });
  test("with too much auth", () => {
    const client = DataApi({
      auth: {
        apiKey: "anything",
        username: "anything",
        password: "anything",
      },
      db: "anything",
      server: "https://example.com",
    });
    expect(client.baseUrl.toString()).toContain(":3030");
  });
});
