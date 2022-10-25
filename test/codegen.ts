import { generateSchemas } from "../src/utils/codegen";

import { config } from "dotenv";
config({ path: ".env.local" });

generateSchemas({
  schemas: [
    // add your layouts and name schemas here
    { layout: "API_Event", schemaName: "Event" },
    { layout: "API_Inventory", schemaName: "Inventory" },
    { layout: "API_Client", schemaName: "Client" },
    { layout: "API_Contact", schemaName: "Contact" },
    { layout: "API_Booth", schemaName: "Booth" },
    { layout: "API_Dispersal", schemaName: "Dispersal" },

    // repeat as needed for each schema...
    // { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
  path: "./test/codegen",
});
