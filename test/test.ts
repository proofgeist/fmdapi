import DataApi from "../src";
import { generateSchemas } from "../src/codegen";
import dotenv from "dotenv";
const result = dotenv.config({ path: "./.env.local" });

if (!process.env.OTTO_API_KEY) throw new Error("No API key");

const client = DataApi({
  auth: { apiKey: process.env.OTTO_API_KEY },
  db: "Demo_NextAuth.fmp12",
  server: "https://foundations-dev.proof-cloud.com",
});
const main = async () => {
  await generateSchemas({
    client,
    schemas: [
      { layout: "metadataTest", schemaName: "TestSchema" },
      {
        layout: "metadataTest",
        schemaName: "TestSchema2",
        strictValueLists: true,
      },
    ],
    useZod: false,
  });
};

main();
