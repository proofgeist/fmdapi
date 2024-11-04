import { OttoAPIKey } from "../src/index.js";
import { generateTypedClients } from "../src/utils/typegen/index.js";
import type { GenerateSchemaOptions } from "../src/utils/typegen/types.js";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const config: GenerateSchemaOptions = {
  schemas: [
    // add your layouts and name schemas here
    { layout: "layout", schemaName: "testLayout", valueLists: "allowEmpty" },
    { layout: "Weird Portals", schemaName: "weirdPortals" },

    // repeat as needed for each schema...
    // { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
  path: "./test/typegen",
  // webviewerScriptName: "webviewer",
  envNames: {
    auth: { apiKey: "DIFFERENT_OTTO_API_KEY" as OttoAPIKey },
    server: "DIFFERENT_FM_SERVER",
    db: "DIFFERENT_FM_DATABASE",
  },
  clientSuffix: "Layout",
};

generateTypedClients(config);
