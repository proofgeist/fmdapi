import { type SourceFile } from "ts-morph";
import type { BuildSchemaArgs, TSchema } from "./types.js";
import { varname } from "./constants.js";

export function buildSchema(
  schemaFile: SourceFile,
  { type, ...args }: BuildSchemaArgs,
): void {
  console.log("buildSchema", args);
  // make sure schema has unique keys, in case a field is on the layout mulitple times
  args.schema.reduce(
    (acc: TSchema[], el) =>
      acc.find((o) => o.name === el.name)
        ? acc
        : ([...acc, el] as Array<TSchema>),
    [],
  );

  if (type === "ts") {
    buildTSSchema(schemaFile, args);
  } else {
    buildZodSchema(schemaFile, args);
  }
}

function buildTSSchema(
  schemaFile: SourceFile,
  args: Pick<
    BuildSchemaArgs,
    "schema" | "schemaName" | "portalSchema" | "valueLists" | "strictNumbers"
  >,
) {
  throw new Error("Not implemented");
  //   const {
  //     schema,
  //     schemaName,
  //     portalSchema = [],
  //     valueLists = [],
  //     strictNumbers = false,
  //   } = args;
  //   const portals = portalSchema.map((p) =>
  //     buildTypeTS(p.schemaName, p.schema, strictNumbers)
  //   );
  //   const vls = valueLists
  //     .filter((vl) => vl.values.length > 0)
  //     .map((vl) => buildValueListTS(vl.name, vl.values));
}

function buildZodSchema(
  schemaFile: SourceFile,
  args: Pick<
    BuildSchemaArgs,
    "schema" | "schemaName" | "portalSchema" | "valueLists" | "strictNumbers"
  >,
) {
  // setup
  const {
    schema,
    schemaName,
    portalSchema = [],
    valueLists = [],
    strictNumbers = false,
  } = args;

  schemaFile.addImportDeclaration({
    moduleSpecifier: "zod",
    namedImports: ["z"],
  });

  // build the portals
  for (const p of portalSchema) {
    buildTypeZod(schemaFile, {
      schemaName: p.schemaName,
      schema: p.schema,
      strictNumbers,
    });
  }

  // build the value lists
  for (const vls of valueLists) {
    if (vls.values.length > 0) {
      buildValueListZod(schemaFile, {
        name: vls.name,
        values: vls.values,
      });
    }
  }

  // build the main schema
  buildTypeZod(schemaFile, {
    schemaName,
    schema,
    strictNumbers,
  });
}

function buildTypeZod(
  schemaFile: SourceFile,
  {
    schemaName,
    schema,
    strictNumbers = false,
  }: {
    schemaName: string;
    schema: Array<TSchema>;
    strictNumbers?: boolean;
  },
) {
  schemaFile.addVariableStatement({
    isExported: true,
    declarations: [
      {
        name: `Z${varname(schemaName)}`,
        initializer: (writer) => {
          writer
            .write(`z.object(`)
            .block(() => {
              for (const field of schema) {
                if (field.type === "string") {
                  writer.writeLine(`${writer.quote(field.name)}: z.string(),`);
                } else if (field.type === "fmnumber") {
                  if (strictNumbers) {
                    writer.writeLine(
                      `${writer.quote(field.name)}: z.number().nullable(),`,
                    );
                  } else {
                    writer.writeLine(
                      `${writer.quote(
                        field.name,
                      )}: z.union([z.string(), z.number()]),`,
                    );
                  }
                } else if (field.type === "valueList") {
                  writer
                    .writeLine(
                      `${writer.quote(field.name)}: z.enum([${field.values?.map(
                        (v, i) =>
                          writer
                            .quote(v)
                            .conditionalWrite(
                              i !== (field.values ?? []).length - 1,
                              ", ",
                            ),
                      )}])`,
                    )
                    .conditionalWrite(field.values?.includes(""), `.catch('')`);
                } else {
                  writer.writeLine(`${writer.quote(field.name)}: z.any()`);
                }
              }
            })
            .write(")");
        },
      },
    ],
  });
  schemaFile.addTypeAlias({
    name: `T${varname(schemaName)}`,
    type: `z.infer<typeof Z${varname(schemaName)}>`,
  });
}

function buildValueListZod(
  schemaFile: SourceFile,
  {
    name,
    values,
  }: {
    name: string;
    values: Array<string>;
  },
) {
  schemaFile.addVariableStatement({
    isExported: true,
    declarations: [
      {
        name: `ZVL${varname(name)}`,
        initializer: (writer) => {
          writer.write(
            `z.enum([${values.map((v, i) =>
              writer.quote(v).conditionalWrite(i !== values.length - 1, ", "),
            )}])`,
          );
        },
      },
    ],
  });
  schemaFile.addTypeAlias({
    name: `TVL${varname(name)}`,
    type: `z.infer<typeof ZVL${varname(name)}>`,
  });
}
