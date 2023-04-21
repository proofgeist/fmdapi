import { DataApi, FileMakerError } from "../src";
import fetch from "jest-fetch-mock";

describe("try to init client", () => {
  test("without server", () => {
    expect(() =>
      DataApi({
        auth: { apiKey: "anything" },
        db: "anything",
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
        // @ts-expect-error the auth object is missing properties
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

const goodResp = {
  response: {
    dataInfo: {
      database: "db",
      layout: "layout",
      table: "fake_table",
      totalRecordCount: 7442,
      foundCount: 7442,
      returnedCount: 1,
    },
    data: [
      {
        fieldData: {
          emailAll: "test@example.com",
          name: "Fake Name",
          emailPrimary: "cgesell@mrschilling.com",
        },
        portalData: {},
        recordId: "5",
        modId: "8",
      },
    ],
  },
  messages: [
    {
      code: "0",
      message: "OK",
    },
  ],
};

describe("client methods (otto)", () => {
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
  });
  beforeEach(() => {
    fetch.resetMocks();
  });
  afterEach(() => {
    expect(fetch.mock.calls.length).toEqual(1);
  });

  test("list", async () => {
    fetch.mockResponseOnce(JSON.stringify(goodResp));

    await client.list({ layout: "layout" });
    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    );
  });
  test("list with limit param", async () => {
    fetch.mockResponseOnce(JSON.stringify(goodResp));
    await client.list({ layout: "layout", limit: 1 });
    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records?_limit=1"
    );
  });
  test("missing layout should error", async () => {
    fetch.mockResponseOnce(JSON.stringify(goodResp));

    await client
      .list({ layout: "not_a_layout" })
      .catch((err) => {
        expect(err).toBeInstanceOf(FileMakerError);
        expect(err.code).toBe("105"); // missing layout error
      })
      .finally(() => {
        expect(fetch.mock.calls[0][0]).toEqual(
          "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/not_a_layout/records"
        );
      });
  });
});
