import { DataApi, FileMakerError } from "../src";
import nock from "nock";
import { z, ZodError } from "zod";

type TCustomer = {
  name: string;
};
const ZCustomer = z.object({ name: z.string() });

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
      .reply(200, {
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
                name: "Fake Name",
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
      });
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
      .reply(200, {
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
                name_badfield: "Fake Name",
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
      });
    // expect this to error
    await client
      .list({})
      .then(() => expect(true).toBe(false))
      .catch((e) => expect(e).toBeInstanceOf(ZodError));
  });
});
