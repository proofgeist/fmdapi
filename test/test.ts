import { DataApi } from "../src";
import { generateSchemas } from "../src/codegen";
import dotenv from "dotenv";
const result = dotenv.config({ path: "./.env.local" });

if (!process.env.OTTO_API_KEY) throw new Error("No API key");

if (
  !process.env.FM_USERNAME ||
  !process.env.FM_PASSWORD ||
  !process.env.FM_DATABASE ||
  !process.env.FM_SERVER
)
  throw new Error("Missing ENV vars");

const client = DataApi({
  auth: {
    username: process.env.FM_USERNAME,
    password: process.env.FM_PASSWORD,
  },
  db: process.env.FM_DATABASE,
  server: process.env.FM_SERVER,
  layout: "dapi",
});

const main = async () => {
  await generateSchemas({
    client,
    schemas: [{ layout: "dapi", schemaName: "Person", valueLists: "strict" }],
  });
};

main();
