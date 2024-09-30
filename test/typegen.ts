// codegen-ignore-import
import { generateTypedClients } from "../src/utils/typegen/index.js";
import type { GenerateSchemaOptions } from "../src/utils/typegen/types.js";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const config: GenerateSchemaOptions = {
  schemas: [
    // add your layouts and name schemas here
    { layout: "layout", schemaName: "testLayout" },
    { layout: "Weird Portals", schemaName: "weirdPortals" },

    // repeat as needed for each schema...
    // { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
  path: "./test/typegen",
  // webviewerScriptName: "webviewer",
  // tokenStore: () => upstashTokenStore({ token: "", url: "" }),
};

generateTypedClients(config);
