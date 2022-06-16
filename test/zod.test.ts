import { DataApi, FileMakerError } from "../src";
import nock from "nock";
import { z, ZodError } from "zod";

type TCustomer = {
  name: string;
  phone: string;
};
const ZCustomer = z.object({ name: z.string(), phone: z.string() });
const record_good = {
  fieldData: {
    name: "Fake Name",
    phone: "5551231234",
  },
  portalData: {},
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
const responseSample = (record: object) => ({
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
  it("should pass validation", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
      },
      { fieldData: ZCustomer }
    );
    const scope = nock("https://example.com:3030")
      .get("/fmi/data/vLatest/databases/db/layouts/layout/records")
      .reply(200, responseSample(record_good));
    const res = await client.list({});
  });
  it("should pass validation allow extra fields", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
      },
      { fieldData: ZCustomer }
    );
    const scope = nock("https://example.com:3030")
      .get("/fmi/data/vLatest/databases/db/layouts/layout/records")
      .reply(200, responseSample(record_extra));
    const res = await client.list({});
  });
  it("list method: should fail validation when field is missing", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
      },
      { fieldData: ZCustomer }
    );
    const scope = nock("https://example.com:3030")
      .get("/fmi/data/vLatest/databases/db/layouts/layout/records")
      .reply(200, responseSample(record_bad));
    // expect this to error
    await client
      .list({})
      .then(() => expect(true).toBe(false))
      .catch((e) => expect(e).toBeInstanceOf(ZodError));
  });
  it("find method: should properly infer from root type", async () => {
    const client = DataApi<any, TCustomer>(
      {
        auth: { apiKey: "KEY_anything" },
        db: "db",
        server: "https://example.com",
        layout: "layout",
      },
      { fieldData: ZCustomer }
    );
    const scope = nock("https://example.com:3030")
      .post("/fmi/data/vLatest/databases/db/layouts/layout/_find")
      .reply(200, responseSample(record_good));

    // the following should not error if typed properly
    const resp = await client.find({ query: { name: "test" } });
    resp.data[0].fieldData.name;
    resp.data[0].fieldData.phone;
  });
});
