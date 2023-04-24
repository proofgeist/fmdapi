/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataApi } from "../src";
import { z, ZodError } from "zod";
import { ZGetResponse } from "../src/client-types";
import fetch from "jest-fetch-mock";
import memoryStore from "../src/tokenStore/memory";

type TCustomer = {
  name: string;
  phone: string;
};
const ZCustomer = z.object({ name: z.string(), phone: z.string() });
const ZPortalTable = z.object({
  "Portal_Table::related_field": z.string(),
});

const ZCustomerPortals = z.object({
  PortalTable: ZPortalTable,
});
type TCustomerPortals = z.infer<typeof ZCustomerPortals>;

const record_good = {
  fieldData: {
    name: "Fake Name",
    phone: "5551231234",
  },
  portalData: {},
  recordId: "5",
  modId: "8",
};
const record_portals = {
  fieldData: {
    name: "Fake Name",
    phone: "5551231234",
  },
  portalData: {
    PortalTable: [
      {
        fieldData: {
          "Portal_Table::related_field": "related field data",
        },
        recordId: "53",
        modId: "3",
      },
    ],
  },
  recordId: "5",
  modId: "8",
};
const record_portals_bad = {
  fieldData: {
    name: "Fake Name",
    phone: "5551231234",
  },
  portalData: {
    PortalTable: [
      {
        fieldData: {
          "Portal_Table::related_field_bad": "related field data",
        },
        portalData: {},
        recordId: "53",
        modId: "3",
      },
    ],
  },
  recordId: "5",
  modId: "8",
};
const record_bad = {
  fieldData: {
    name_badfield: "Fake Name",
    phone: "5551231234",
  },
  portalData: {},
  recordId: "5",
  modId: "8",
};
const record_extra = {
  fieldData: {
    name: "Fake Name",
    phone: "5551231234",
    extraField: "Fake Name",
  },
  portalData: {},
  recordId: "5",
  modId: "8",
};
const responseSample = (record: object) =>
  JSON.stringify({
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
  });

describe("zod validation", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });
  afterEach(() => {
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("should pass validation", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
        tokenStore: memoryStore(),
      },
      { fieldData: ZCustomer }
    );

    fetch.mockResponseOnce(responseSample(record_good));

    await client.list({});

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    );
  });
  it("should pass validation allow extra fields", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
        tokenStore: memoryStore(),
      },
      { fieldData: ZCustomer }
    );

    fetch.mockResponseOnce(responseSample(record_extra));
    await client.list({});

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    );
  });
  it("list method: should fail validation when field is missing", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
        tokenStore: memoryStore(),
      },
      { fieldData: ZCustomer }
    );

    fetch.mockResponseOnce(responseSample(record_bad));

    await expect(client.list({})).rejects.toBeInstanceOf(ZodError);

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    );
    // expect this to error
  });
  it("find method: should properly infer from root type", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
        tokenStore: memoryStore(),
      },
      { fieldData: ZCustomer }
    );

    fetch.mockResponseOnce(responseSample(record_good));

    // the following should not error if typed properly
    const resp = await client.find({ query: { name: "test" } });
    resp.data[0].fieldData.name;
    resp.data[0].fieldData.phone;

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/_find"
    );
  });
  it("client with portal data passed as zod type", async () => {
    const client = DataApi<any, TCustomer, TCustomerPortals>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
        tokenStore: memoryStore(),
      },
      { fieldData: ZCustomer, portalData: ZCustomerPortals }
    );

    fetch.mockResponseOnce(responseSample(record_portals));

    await client
      .list({})
      .then(
        (data) =>
          data.data[0].portalData.PortalTable[0]["Portal_Table::related_field"]
      )
      .catch();

    expect(fetch.mock.calls[0][0]).toEqual(
      "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/records"
    );
  });
  it("client with portal data fails validation", async () => {
    expect(() =>
      ZGetResponse({
        fieldData: ZCustomer,
        portalData: ZCustomerPortals,
      }).parse(record_portals_bad)
    ).toThrowError(ZodError);
  });
});

it("should properly type limit/offset in portals", async () => {
  const client = DataApi<any, TCustomer, TCustomerPortals>(
    {
      auth: { apiKey: "KEY_anything" },
      db: "db",
      server: "https://example.com",
      layout: "layout",
      tokenStore: memoryStore(),
    },
    { fieldData: ZCustomer, portalData: ZCustomerPortals }
  );

  fetch.mockResponseOnce(responseSample(record_good));

  await client.find({
    query: { name: "test" },
    portalRanges: { PortalTable: { limit: 500, offset: 5 } },
  });

  expect(fetch.mock.calls[0][0]).toEqual(
    "https://example.com:3030/fmi/data/vLatest/databases/db/layouts/layout/_find"
  );
});
