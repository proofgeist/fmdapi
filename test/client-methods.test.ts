import { DataApi } from "../src";
import {
  LayoutsResponse,
  Layout,
  LayoutsFolder,
  ScriptsMetadataResponse,
  ScriptOrFolder,
} from "../src/client-types";
import { config } from "./setup";

describe("find methods", () => {
  const client = DataApi({
    auth: config.auth,
    db: config.db,
    server: config.server,
  });

  test("successful find", async () => {
    const resp = await client.find({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(Array.isArray(resp.data)).toBe(true);
  });
  test("successful findFirst with multiple return", async () => {
    const resp = await client.findFirst({
      layout: "layout",
      query: { anything: "anything" },
    });
    expect(Array.isArray(resp.data)).toBe(false);
  });
  test("successful findOne", async () => {
    const resp = await client.findOne({
      layout: "layout",
      query: { anything: "unique" },
    });

    expect(Array.isArray(resp.data)).toBe(false);
  });
});

describe("other methods", () => {
  it("should allow list method without layout param", async () => {
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
      layout: "layout",
    });

    await client.list();
  });
  it("should require list method to have layout param", async () => {
    // if not passed into the top-level client
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
    });

    expect(client.list()).rejects.toThrow();
  });

  it("findOne with 2 results should fail", async () => {
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
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
      auth: config.auth,
      db: config.db,
      server: config.server,
    });

    await client.list({
      layout: "layout",
      offset: 0,
    });
  });

  it("should retrieve a list of folders and layouts", async () => {
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
    });

    const resp = (await client.layouts()) as LayoutsResponse;

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
      auth: config.auth,
      db: config.db,
      server: config.server,
    });

    const resp = (await client.scripts()) as ScriptsMetadataResponse;

    expect(Object.prototype.hasOwnProperty.call(resp, "scripts")).toBe(true);
    expect(resp.scripts.length).toBe(2);
    expect(resp.scripts[0] as ScriptOrFolder).toHaveProperty("name");
    expect(resp.scripts[1] as ScriptOrFolder).toHaveProperty("isFolder");
  });

  it("should paginate through all records", async () => {
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
      layout: "layout",
    });

    const data = await client.listAll({ limit: 1 });
    expect(data.length).toBe(3);
  });

  it("should paginate using findAll method", async () => {
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
      layout: "layout",
    });

    const data = await client.findAll({
      query: { anything: "anything" },
      limit: 1,
    });
    expect(data.length).toBe(2);
  });

  it("should return from execute script", async () => {
    const client = DataApi({
      auth: config.auth,
      db: config.db,
      server: config.server,
      layout: "layout",
    });

    const param = JSON.stringify({ hello: "world" });

    const resp = await client.executeScript({
      script: "script",
      scriptParam: param,
    });

    expect(resp.scriptResult).toBe("result");
  });
});
