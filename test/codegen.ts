// codegen-ignore-import
import { GenerateSchemaOptions, generateSchemas } from "../src/utils/codegen";

/* codegen-ignore */
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
  path: "./test/codegen",
  // webviewerScriptName: "webviewer",
  // tokenStore: () => upstashTokenStore({ token: "", url: "" }),
};

generateSchemas(config);
