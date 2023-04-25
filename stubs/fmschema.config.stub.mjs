/**
 * @type {import("@proofgeist/fmdapi/dist/utils/codegen").GenerateSchemaOptions}
 */
export const config = {
  schemas: [
    // add your layouts and name schemas here
    { layout: "my_layout", schemaName: "MySchema" },

    // repeat as needed for each schema...
    // { layout: "my_other_layout", schemaName: "MyOtherSchema" },
  ],
};
