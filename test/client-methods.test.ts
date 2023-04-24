import { DataApi } from "../src";
import {
  LayoutsResponse,
  Layout,
  LayoutsFolder,
  ScriptsMetadataResponse,
  ScriptOrFolder,
} from "../src/client-types";
import fetch from "jest-fetch-mock";
import memoryStore from "../src/tokenStore/memory";

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
const goodScriptsResp = {
  response: {
    scripts: [
      {
        name: "script1",
        isFolder: false,
      },
      {
        name: "Group",
        isFolder: true,
        folderScriptNames: [
          {
            name: "script2",
            isFolder: false,
          },
        ],
      },
    ],
  },
};
const goodExecuteScriptResp = {
  response: {
    scriptResult: "result",
    scriptError: "0",
  },
  messages: [
    {
      code: "0",
      message: "OK",
    },
  ],
};

describe("find methods", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });
  afterEach(() => {
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(1);
  });

  test("successful find", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodFindResp));

    const resp = await client.find({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/_find"
    );
    expect(Array.isArray(resp.data)).toBe(true);
  });
  test("successful findFirst with multiple return", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodFindResp2));

    const resp = await client.findFirst({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/_find"
    );
    expect(Array.isArray(resp.data)).toBe(false);
  });
  test("successful findOne", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodFindResp));

    const resp = await client.findOne({
      layout: "layout",
      query: { anything: "anything" },
    });

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/_find"
    );

    expect(Array.isArray(resp.data)).toBe(false);
  });
});

describe("other methods", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it("should allow list method without layout param", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      layout: "layout",
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodFindResp));
    await client.list();
    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    );
  });
  it("should require list method to have layout param", async () => {
    // if not passed into the top-level client
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodFindResp));

    expect(client.list()).rejects.toThrow();
    // expect(fetch.mock.calls[0][0]).toEqual(
    //   "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    // );
  });

  it("findOne with 2 results should fail", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });

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
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodFindResp));

    await client.list({
      layout: "layout",
      offset: 0,
    });
    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records?_offset=0"
    );
  });

  it("should retrieve a list of folders and layouts", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });
    fetch.mockResponseOnce(JSON.stringify(goodLayoutsResp));

    const resp = (await client.layouts()) as LayoutsResponse;

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts"
    );

    expect(Object.prototype.hasOwnProperty.call(resp, "layouts")).toBe(true);
    expect(resp.layouts.length).toBe(2);
    expect(resp.layouts[0] as Layout).toHaveProperty("name");
    expect(resp.layouts[1] as LayoutsFolder).toHaveProperty("isFolder");
    expect(resp.layouts[1] as LayoutsFolder).toHaveProperty(
      "folderLayoutNames"
    );
  });
  it("should retrieve a list of folders and scripts", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      tokenStore: memoryStore(),
    });

    fetch.mockResponseOnce(JSON.stringify(goodScriptsResp));

    const resp = (await client.scripts()) as ScriptsMetadataResponse;

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/scripts"
    );

    expect(Object.prototype.hasOwnProperty.call(resp, "scripts")).toBe(true);
    expect(resp.scripts.length).toBe(2);
    expect(resp.scripts[0] as ScriptOrFolder).toHaveProperty("name");
    expect(resp.scripts[1] as ScriptOrFolder).toHaveProperty("isFolder");
  });

  it("should paginate through all records", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      layout: "layout",
      tokenStore: memoryStore(),
    });

    fetch.mockResponse(JSON.stringify(goodFindResp));

    const data = await client.listAll({ limit: 1 });
    expect(data.length).toBe(2);
    expect(fetch.mock.calls.length).toBe(2);
  });

  it("should paginate using findAll method", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      layout: "layout",
      tokenStore: memoryStore(),
    });

    fetch.mockResponse(JSON.stringify(goodFindResp));

    const data = await client.findAll({ query: {}, limit: 1 });
    expect(data.length).toBe(2);
    expect(fetch.mock.calls.length).toBe(2);
  });

  it("should return from execute script", async () => {
    const client = DataApi({
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      layout: "layout",
      tokenStore: memoryStore(),
    });

    const param = JSON.stringify({ hello: "world" });

    fetch.mockResponseOnce(JSON.stringify(goodExecuteScriptResp));

    const resp = await client.executeScript({
      script: "script",
      scriptParam: param,
    });

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/script/script?script.param=%7B%22hello%22%3A%22world%22%7D"
    );

    expect(resp.scriptResult).toBe("result");
  });
});
