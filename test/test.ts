import DataApi from "../src";
import { generateSchemas } from "../src/codegen";
import dotenv from "dotenv";
const result = dotenv.config({ path: "./.env.local" });

if (!process.env.OTTO_API_KEY) throw new Error("No API key");

const client = DataApi({
  auth: { apiKey: process.env.OTTO_API_KEY },
  db: "Portal.fmp12",
  server: "https://shallan-web.gicloud.net",
});
const main = async () => {
  await generateSchemas({
    client,
    schemas: [{ layout: "edd_customer_web", schemaName: "Customer" }],
  });
};

main();
