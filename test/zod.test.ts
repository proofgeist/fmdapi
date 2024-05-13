/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataApi } from "../src";
import { z, ZodError } from "zod";
import { ZGetResponse } from "../src/client-types";
import { config } from "./setup";

type TCustomer = {
  name: string;
  phone: string;
};
const ZCustomer = z.object({ name: z.string(), phone: z.string() });
const ZPortalTable = z.object({
  "related::related_field": z.string(),
});

const ZCustomerPortals = z.object({
  PortalTable: ZPortalTable,
});
type TCustomerPortals = z.infer<typeof ZCustomerPortals>;

const client = DataApi<any, TCustomer>(
  {
    auth: config.auth,
    db: config.db,
    server: config.server,
    layout: "customer",
  },
  { fieldData: ZCustomer }
);
const clientPortalData = DataApi<any, TCustomer, TCustomerPortals>(
  {
    auth: config.auth,
    db: config.db,
    server: config.server,
    layout: "customer",
  },
  { fieldData: ZCustomer, portalData: ZCustomerPortals }
);

const record_portals_bad = {
  fieldData: {
    name: "Fake Name",
    phone: "5551231234",
  },
  portalData: {
    PortalTable: [
      {
        fieldData: {
          "related::related_field_bad": "related field data",
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

describe("zod validation", () => {
  it("should pass validation, allow extra fields", async () => {
    await client.list();
  });
  it("list method: should fail validation when field is missing", async () => {
    await expect(
      client.list({ layout: "customer_fieldsMissing" })
    ).rejects.toBeInstanceOf(ZodError);
  });
  it("find method: should properly infer from root type", async () => {
    // the following should not error if typed properly
    const resp = await client.find({ query: { name: "test" } });
    resp.data[0].fieldData.name;
    resp.data[0].fieldData.phone;
  });
  it("client with portal data passed as zod type", async () => {
    await clientPortalData
      .list({})
      .then(
        (data) =>
          data.data[0].portalData.PortalTable[0]["related::related_field"]
      )
      .catch();
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
  await clientPortalData.find({
    query: { name: "test" },
    portalRanges: { PortalTable: { limit: 500, offset: 5 } },
  });
});
