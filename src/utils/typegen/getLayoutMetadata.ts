import { type DataApi } from "../../client.js";
import { TSchema, ValueListsOptions } from "./types.js";
import { F } from "ts-toolbelt";
import chalk from "chalk";
import { FieldMetaData, FileMakerError } from "../../client-types.js";

/**
 * Calls the FileMaker Data API to get the layout metadata and returns a schema
 */
export const getLayoutMetadata = async (args: {
  client: ReturnType<typeof DataApi>;
  layout: string;
  valueLists?: ValueListsOptions;
}) => {
  const schemaReducer: F.Function<[FieldMetaData[]], TSchema[]> = (schema) =>
    schema.reduce((acc, field) => {
      if (acc.find((o) => o.name === field.name)) return acc; // skip duplicates
      if (
        meta &&
        field.valueList &&
        meta.valueLists &&
        valueLists !== "ignore"
      ) {
        const list = meta.valueLists.find((o) => o.name === field.valueList);
        const values = list?.values.map((o) => o.value) ?? [];
        return [
          ...acc,
          {
            name: field.name,
            type: "valueList",
            values: valueLists === "allowEmpty" ? [...values, ""] : values,
          },
        ];
      }
      return [
        ...acc,
        {
          name: field.name,
          type: field.result === "number" ? "fmnumber" : "string",
        },
      ];
    }, [] as TSchema[]);

  const { client, layout, valueLists = "ignore" } = args;
  const meta = await client.layoutMetadata({ layout }).catch((err) => {
    if (err instanceof FileMakerError && err.code === "105") {
      console.log(
        chalk.bold.red("ERROR:"),
        "Skipping schema generation for layout:",
        chalk.bold.underline(layout),
        "(not found)"
      );
      return;
    }
    throw err;
  });
  if (!meta) return;
  const schema = schemaReducer(meta.fieldMetaData);
  const portalSchema = Object.keys(meta.portalMetaData).map((schemaName) => {
    const schema = schemaReducer(meta.portalMetaData[schemaName]);
    return { schemaName, schema };
  });
  const valueListValues =
    meta.valueLists?.map((vl) => ({
      name: vl.name,
      values: vl.values.map((o) => o.value),
    })) ?? [];
  // remove duplicates from valueListValues
  const valueListValuesUnique = valueListValues.reduce((acc, vl) => {
    if (acc.find((o) => o.name === vl.name)) return acc;
    return [...acc, vl];
  }, [] as typeof valueListValues);

  return { schema, portalSchema, valueLists: valueListValuesUnique };
};
