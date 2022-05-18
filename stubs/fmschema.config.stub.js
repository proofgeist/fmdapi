// change this to point to your own .env file as needed
require("dotenv").config({ path: ".env.local" });

/**
 * @type {import("@proofgeist/fmdapi/dist/utils/codegen").GenerateSchemaOptions}
 */
const config = {
  clientConfig: {
    auth: { apiKey: process.env.OTTO_API_KEY },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  },
  schemas: [
    // add your layouts and name schemas here
    { layout: "my_layout", schemaName: "MySchema" },

    // repeat as needed for each schema...
    { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
};
module.exports = config;
