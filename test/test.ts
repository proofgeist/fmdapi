const { DataApi } = require("../src/index");
const { generateSchemas } = require("../src/utils/codegen");

require("dotenv").config({ path: ".env.local" });
if (!process.env.OTTO_API_KEY) throw new Error("Need Otto API key");

const client = DataApi({
  auth: { apiKey: process.env.OTTO_API_KEY },
  db: "Portal.fmp12",
  server: "https://shallan-web.gicloud.net",
});

generateSchemas({
  client,
  schemas: [
    { layout: "edd_customer_web", schemaName: "EDDCustomer" },
    { layout: "edd_license_full_web", schemaName: "EDDLicense" },
  ],
});
