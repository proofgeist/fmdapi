// codegen-ignore-import
import { GenerateSchemaOptions, generateSchemas } from "../src/utils/codegen";

import fileStorage from "../src/tokenStore/file";

/* codegen-ignore */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const config: GenerateSchemaOptions = {
  schemas: [
    // add your layouts and name schemas here
    { layout: "API User", schemaName: "User" },
    { layout: "API Events", schemaName: "Event" },
    { layout: "API EventSchedule", schemaName: "EventSchedule" },
    { layout: "API Applicant", schemaName: "Applicant", valueLists: "strict" },
    {
      layout: "API EventLine",
      schemaName: "EventLine",
      strictNumbers: true,
    },
    { layout: "Inbox", schemaName: "Inbox" },

    // repeat as needed for each schema...
    // { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
  path: "./test/codegen",
  // tokenStore: () => upstashTokenStore({ token: "", url: "" }),
};

generateSchemas(config, "./test/codegen.ts");
