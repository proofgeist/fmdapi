/**
 * @type {import("@proofgeist/fmdapi/dist/utils/typegen/types.d.ts").GenerateSchemaOptions}
 */
const config = {
  clientSuffix: "Layout",
  schemas: [
    // add your layouts and name schemas here
    { layout: "my_layout", schemaName: "MySchema" },

    // repeat as needed for each schema...
    // { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
  // change this value to generate the files in a different directory
  path: "schema",
  clearOldFiles: true,
};
module.exports = config;
