import { z, ZodObject, ZodObjectDef } from "zod";
import {
  FieldData,
  GenericPortalData,
  getFMRecordAsZod,
  PortalsWithIds,
} from "../src/client-types";
import { DataApi } from "../src";
import { config } from "dotenv";
type ZodGenericPortalData = z.ZodObject<{
  [key: string]: z.ZodObject<z.ZodRawShape>;
}>;

const ZEDDLicense = z.object({
  license_key: z.string(),
  full_product_name: z.string(),
  expiration: z.string(),
  last_checked_timestamp: z.string(),
  id: z.union([z.string(), z.number()]),
  customer_id: z.union([z.string(), z.number()]),
  customer_name: z.string(),
  customer_email: z.string(),
  download_id: z.union([z.string(), z.number()]),
  price_id: z.union([z.string(), z.number()]),
});
type TEDDLicense = z.infer<typeof ZEDDLicense>;
const ZActivations = z.object({
  "EDD_ACTIVATIONS_active::name": z.string(),
  "EDD_ACTIVATIONS_active::last_checked_timestamp": z.string(),
  "EDD_ACTIVATIONS_active::interval_between_checks": z.string(),
});
type TActivations = z.infer<typeof ZActivations>;
const ZPortal = z.object({
  Activations: ZActivations.extend({ recordId: z.string(), modId: z.string() }),
});
type TPortal = z.infer<typeof ZPortal>;

// const validateFromFm = (data) => {
//   const zod = getFMRecordAsZod({
//     fieldData: ZEDDLicense,
//     portalData: ZPortal,
//   });
//   const validatedData = zod.parse(data);
//   return validatedData;
// };

require("dotenv").config({ path: ".env.local" });
const client = DataApi({
  auth: { apiKey: process.env.OTTO_API_KEY ?? "" },
  db: process.env.FM_DATABASE ?? "",
  server: process.env.FM_SERVER ?? "",
  layout: "edd_license_full_web",
});

// client
//   .list({ zod: { fieldData: ZEDDLicense, portalData: ZPortal } })
//   .then((data) => data.data.map((d) => console.log(d.fieldData)));


client.list({zod: {fieldData: ZEDDLicense, portalData: ZPortal}}).then(data=> data.data[0].fieldData.)
ZEDDLicense