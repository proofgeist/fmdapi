import { DataApi, FileMakerError } from "../src";
import {
  LayoutsResponse,
  LayoutOrFolder,
  Layout,
  LayoutsFolder,
} from "../src/client-types";
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
      totalRecordCount: 2,
      foundCount: 2,
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
const goodLayoutsResp = {
  response: {
    layouts: [
      {
        name: "layout1",
        table: "",
      },
      {
        name: "Group",
        isFolder: true,
        folderLayoutNames: [
          {
            name: "layout2",
            table: "",
          },
        ],
      },
    ],
  },
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
  await client.list();
  expect(scope.isDone()).toBe(true);
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

it("findOne with 2 results should fail", async () => {
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

it("should rename offset param", async () => {
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
  });
  const scope = nock("https://example.com:3030")
    .get("/fmi/data/vLatest/databases/db/layouts/layout/records?_offset=0")
    .reply(200, goodFindResp);

  await client.list({
    layout: "layout",
    offset: 0,
  });
  expect(scope.isDone()).toBe(true);
});

it("should retrieve a list of folders and layouts", async () => {
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
  });

  const scope = nock("https://example.com:3030")
    .post("/fmi/data/vLatest/databases/db/layouts")
    .reply(200, goodLayoutsResp);

  const resp = (await client.layouts()) as LayoutsResponse;

  expect(scope.isDone()).toBe(true);
  expect(resp.hasOwnProperty("layouts")).toBe(true);
  expect(resp.layouts.length).toBe(2);
  expect(resp.layouts[0] as Layout).toHaveProperty("name");
  expect(resp.layouts[1] as LayoutsFolder).toHaveProperty("isFolder");
  expect(resp.layouts[1] as LayoutsFolder).toHaveProperty("folderLayoutNames");
});

it("should paginate through all records", async () => {
  const client = DataApi({
    auth: { apiKey: "KEY_anything" },
    db: "db",
    server: "https://example.com",
    layout: "layout",
  });

  const page1 = nock("https://example.com:3030")
    .get("/fmi/data/vLatest/databases/db/layouts/layout/records?_limit=1")
    .reply(200, goodFindResp);
  const page2 = nock("https://example.com:3030")
    .get(
      "/fmi/data/vLatest/databases/db/layouts/layout/records?_offset=1&_limit=1"
    )
    .reply(200, goodFindResp);

  const data = await client.listAll({ limit: 1 });
  expect(data.length).toBe(2);
  expect(page1.isDone()).toBe(true);
  expect(page2.isDone()).toBe(true);
});
