import { DataApi, OttoAdapter } from "../src";
import {
  Layout,
  ScriptsMetadataResponse,
  ScriptOrFolder,
  AllLayoutsMetadataResponse,
} from "../src/client-types";
import {
  config,
  layoutClient,
  weirdPortalClient,
  containerClient,
} from "./setup";
import { describe, test, expect, it } from "vitest";

describe("sort methods", () => {
  test("should sort descending", async () => {
    const resp = await layoutClient.list({
      sort: { fieldName: "recordId", sortOrder: "descend" },
    });
    expect(resp.data.length).toBe(3);
    const firstRecord = parseInt(resp.data[0].fieldData.recordId as string);
    const secondRecord = parseInt(resp.data[1].fieldData.recordId as string);
    expect(firstRecord).toBeGreaterThan(secondRecord);
  });
  test("should sort ascending by default", async () => {
    const resp = await layoutClient.list({
      sort: { fieldName: "recordId" },
    });

    const firstRecord = parseInt(resp.data[0].fieldData.recordId as string);
    const secondRecord = parseInt(resp.data[1].fieldData.recordId as string);
    expect(secondRecord).toBeGreaterThan(firstRecord);
  });
});

describe("find methods", () => {
  const client = DataApi({
    adapter: new OttoAdapter({
      auth: config.auth,
      db: config.db,
      server: config.server,
    }),
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
  it("find with omit", async () => {
    await layoutClient.find<{ anything: string }>({
      query: { anything: "anything", omit: "true" },
    });
  });
});

describe("portal methods", () => {
  it("should return portal data with limit and offset", async () => {
    const result = await layoutClient.list({
      limit: 1,
    });
    expect(result.data[0].portalData.test.length).toBe(50); // default portal limit is 50

    const { data } = await layoutClient.list({
      limit: 1,
      portalRanges: { test: { limit: 1, offset: 2 } },
    });
    expect(data.length).toBe(1);

    const portalData = data[0].portalData;
    const testPortal = portalData.test;
    expect(testPortal.length).toBe(1);
    expect(testPortal[0]["related::related_field"]).toContain("2"); // we should get the 2nd record
  });
  it("should update portal data", async () => {
    await layoutClient.update({
      recordId: 1,
      fieldData: { anything: "anything" },
      portalData: {
        test: [{ "related::related_field": "updated", recordId: "1" }],
      },
    });
  });
  it("should handle portal methods with strange names", async () => {
    const { data } = await weirdPortalClient.list({
      limit: 1,
      portalRanges: {
        "long_and_strange.portalName#forTesting": { limit: 100 },
      },
    });

    expect(
      "long_and_strange.portalName#forTesting" in data[0].portalData,
    ).toBeTruthy();

    const portalData =
      data[0].portalData["long_and_strange.portalName#forTesting"];

    expect(portalData.length).toBeGreaterThan(50);
  });
});

describe("other methods", () => {
  it("should allow list method without layout param", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
      layout: "layout",
    });

    await client.list();
  });
  it("should require list method to have layout param", async () => {
    // if not passed into the top-level client
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
    });

    await expect(client.list()).rejects.toThrow();
  });

  it("findOne with 2 results should fail", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
    });

    await expect(
      client.findOne({
        layout: "layout",
        query: { anything: "anything" },
      }),
    ).rejects.toThrow();
  });

  it("should rename offset param", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
    });

    await client.list({
      layout: "layout",
      offset: 0,
    });
  });

  it("should retrieve a list of folders and layouts", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
    });

    const resp = (await client.layouts()) as AllLayoutsMetadataResponse;

    expect(Object.prototype.hasOwnProperty.call(resp, "layouts")).toBe(true);
    expect(resp.layouts.length).toBeGreaterThanOrEqual(2);
    expect(resp.layouts[0] as Layout).toHaveProperty("name");
    const layoutFoler = resp.layouts.find((o) => "isFolder" in o);
    expect(layoutFoler).not.toBeUndefined();
    expect(layoutFoler).toHaveProperty("isFolder");
    expect(layoutFoler).toHaveProperty("folderLayoutNames");
  });
  it("should retrieve a list of folders and scripts", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
    });

    const resp = (await client.scripts()) as ScriptsMetadataResponse;

    expect(Object.prototype.hasOwnProperty.call(resp, "scripts")).toBe(true);
    expect(resp.scripts.length).toBe(2);
    expect(resp.scripts[0] as ScriptOrFolder).toHaveProperty("name");
    expect(resp.scripts[1] as ScriptOrFolder).toHaveProperty("isFolder");
  });

  it("should paginate through all records", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
      layout: "layout",
    });

    const data = await client.listAll({ limit: 1 });
    expect(data.length).toBe(3);
  });

  it("should paginate using findAll method", async () => {
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
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
      adapter: new OttoAdapter({
        auth: config.auth,
        db: config.db,
        server: config.server,
      }),
      layout: "layout",
    });

    const param = JSON.stringify({ hello: "world" });

    const resp = await client.executeScript({
      script: "script",
      scriptParam: param,
      layout: client.layout,
    });

    expect(resp.scriptResult).toBe("result");
  });
});

describe("container field methods", () => {
  it("should upload a file to a container field", async () => {
    await containerClient.containerUpload({
      containerFieldName: "myContainer",
      file: Buffer.from("test/fixtures/test.txt"),
      recordId: "1",
    });
  });

  it("should handle container field repetition", async () => {
    await containerClient.containerUpload({
      containerFieldName: "repeatingContainer",
      containerFieldRepetition: 2,
      file: Buffer.from("test/fixtures/test.txt"),
      recordId: "1",
    });
  });
});
