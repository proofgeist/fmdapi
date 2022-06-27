import { DataApi, FileMakerError } from "../src";
import nock from "nock";

const record = {
  fieldData: {
    emailAll: "test@example.com",
    name: "Fake Name",
    emailPrimary: "cgesell@mrschilling.com",
  },
  portalData: {},
  recordId: "5",
  modId: "8",
};
const goodFindResp = {
  response: {
    dataInfo: {
      database: "db",
      layout: "layout",
      table: "fake_table",
      totalRecordCount: 7442,
      foundCount: 7442,
      returnedCount: 1,
    },
    data: [record],
  },
  messages: [
    {
      code: "0",
      message: "OK",
    },
  ],
};
const goodFindResp2 = {
  response: { ...goodFindResp.response, data: [record, record] },
};

describe("find methods", () => {
  test("successful find", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
    });
    const scope = nock("https://example.com:3030")
      .post("/fmi/data/vLatest/databases/db/layouts/layout/_find")
      .reply(200, goodFindResp);

    const resp = await client.find({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(scope.isDone()).toBe(true);
    expect(Array.isArray(resp.data)).toBe(true);
  });
  test("successful findFirst with multiple return", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
    });
    const scope = nock("https://example.com:3030")
      .post("/fmi/data/vLatest/databases/db/layouts/layout/_find")
      .reply(200, goodFindResp2);

    const resp = await client.findFirst({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(scope.isDone()).toBe(true);
    expect(Array.isArray(resp.data)).toBe(false);
  });
  test("successful findOne", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
    });
    const scope = nock("https://example.com:3030")
      .post("/fmi/data/vLatest/databases/db/layouts/layout/_find")
      .reply(200, goodFindResp);

    const resp = await client.findOne({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(scope.isDone()).toBe(true);
    expect(Array.isArray(resp.data)).toBe(false);
  });
});

test("findOne with 2 results should fail", async () => {
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
  });
  const scope = nock("https://example.com:3030")
    .post("/fmi/data/vLatest/databases/db/layouts/layout/_find")
    .reply(200, goodFindResp2);

  expect(
    client.findOne({
      layout: "layout",
      query: { anything: "anything" },
    })
  ).rejects.toThrow();
});

it("should allow list method without layout param", async () => {
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
    layout: "layout",
  });
  const scope = nock("https://example.com:3030")
    .get("/fmi/data/vLatest/databases/db/layouts/layout/records")
    .reply(200, goodFindResp);
  expect(client.list()).rejects.toThrow();
});
it("should require list method to have layout param", async () => {
  // if not passed into the top-level client
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
  });
  const scope = nock("https://example.com:3030")
    .get("/fmi/data/vLatest/databases/db/layouts/layout/records")
    .reply(200, goodFindResp);

  expect(client.list()).rejects.toThrow();
  expect(scope.isDone()).toBe(false);
});
