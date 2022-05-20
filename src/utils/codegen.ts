import fs from "fs-extra";
import { join } from "path";
import ts, {
  factory,
  createSourceFile,
  createPrinter,
  Statement,
} from "typescript";
import { FileMakerError, DataApi } from "..";
import { FieldMetaData } from "../client-types";
import { F } from "ts-toolbelt";
import dayjs from "dayjs";
import chalk from "chalk";
import { ClientObjectProps } from "../client";

type TSchema = {
  name: string;
  type: "string" | "fmnumber" | "valueList";
  values?: string[];
};

const varname = (name: string) =>
  name.replace(/[^a-zA-Z_]+|[^a-zA-Z_0-9]+/g, "");

const commentHeader = `/**
* Generated by @proofgeist/fmdapi package
* ${dayjs().format("YYYY-MM-DD hh:mm a Z")}
* https://github.com/proofgeist/fmdapi
* DO NOT EDIT THIS FILE DIRECTLY. Changes may be overritten
*/

`;

const stringProperty = (name: string) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  );
const stringPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("z"),
        factory.createIdentifier("string")
      ),
      undefined,
      []
    )
  );
const stringOrNumberProperty = (name: string) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createUnionTypeNode([
      factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ])
  );
const stringOrNumberPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("z"),
        factory.createIdentifier("union")
      ),
      undefined,
      [
        factory.createArrayLiteralExpression(
          [
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("z"),
                factory.createIdentifier("string")
              ),
              undefined,
              []
            ),
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("z"),
                factory.createIdentifier("number")
              ),
              undefined,
              []
            ),
          ],
          false
        ),
      ]
    )
  );
const valueListProperty = (name: string, vl: string[]) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createUnionTypeNode(
      vl.map((v) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(v))
      )
    )
  );
const valueListPropertyZod = (name: string, vl: string[]) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("z"),
        factory.createIdentifier("enum")
      ),
      undefined,
      [
        factory.createArrayLiteralExpression(
          vl.map((v) => factory.createStringLiteral(v)),
          false
        ),
      ]
    )
  );

const buildTypeZod = (
  schemaName: string,
  schema: Array<TSchema>
): Statement[] => [
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(`Z${varname(schemaName)}`),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("z"),
              factory.createIdentifier("object")
            ),
            undefined,
            [
              factory.createObjectLiteralExpression(
                // for each field, create a z property
                schema.map((item) =>
                  item.type === "fmnumber"
                    ? stringOrNumberPropertyZod(item.name)
                    : item.values
                    ? valueListPropertyZod(item.name, item.values)
                    : stringPropertyZod(item.name)
                ),
                true
              ),
            ]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  ),
  factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`T${varname(schemaName)}`),
    undefined,
    factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier("z"),
        factory.createIdentifier("infer")
      ),
      [
        factory.createTypeQueryNode(
          factory.createIdentifier(`Z${varname(schemaName)}`)
        ),
      ]
    )
  ),
];
const buildValueListZod = (name: string, values: string[]): Statement[] => [
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(`ZVL${varname(name)}`),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("z"),
              factory.createIdentifier("enum")
            ),
            undefined,
            [
              factory.createArrayLiteralExpression(
                values.map((v) => factory.createStringLiteral(v)),
                false
              ),
            ]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  ),
  factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`TVL${varname(name)}`),
    undefined,
    factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier("z"),
        factory.createIdentifier("infer")
      ),
      [
        factory.createTypeQueryNode(
          factory.createIdentifier(`ZVL${varname(name)}`)
        ),
      ]
    )
  ),
];
const buildValueListTS = (name: string, values: string[]): Statement =>
  factory.createTypeAliasDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(`TVL${varname(name)}`),
    undefined,
    factory.createUnionTypeNode(
      values.map((v) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(v))
      )
    )
  );

const buildTypeTS = (schemaName: string, schema: Array<TSchema>): Statement =>
  factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`T${varname(schemaName)}`),
    undefined,
    factory.createTypeLiteralNode(
      // for each field, create a property
      schema.map((item) => {
        return item.type === "fmnumber"
          ? stringOrNumberProperty(item.name)
          : item.values
          ? valueListProperty(item.name, item.values)
          : stringProperty(item.name);
      })
    )
  );

type BuildSchemaArgs = {
  schemaName: string;
  schema: Array<TSchema>;
  type: "zod" | "ts";
  portalSchema?: { schemaName: string; schema: Array<TSchema> }[];
  valueLists?: { name: string; values: string[] }[];
};
export const buildSchema = (args: BuildSchemaArgs) => {
  const { schemaName, type, portalSchema = [], valueLists = [] } = args;
  // make sure schema has unique keys, in case a field is on the layout mulitple times
  const schema = args.schema.reduce(
    (acc: TSchema[], el) =>
      acc.find((o) => o.name === el.name)
        ? acc
        : ([...acc, el] as Array<TSchema>),
    []
  );
  // TODO same uniqueness validation for portals
  const printer = createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const file =
    type === "ts"
      ? buildTSSchema({ schemaName, schema, portalSchema, valueLists })
      : buildZodSchema({ schemaName, schema, portalSchema, valueLists });
  return commentHeader + printer.printFile(file);
};

const buildZodSchema = (args: Omit<BuildSchemaArgs, "type">) => {
  const { schema, schemaName, portalSchema = [], valueLists = [] } = args;
  const portals = portalSchema
    .map((p) => buildTypeZod(p.schemaName, p.schema))
    .flat();
  const vls = valueLists
    .map((vl) => buildValueListZod(vl.name, vl.values))
    .flat();

  const portalStatements = [
    factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(`Z${schemaName}Portals`),
            undefined,
            undefined,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("z"),
                factory.createIdentifier("object")
              ),
              undefined,
              [
                factory.createObjectLiteralExpression(
                  portalSchema.map((portal) =>
                    factory.createPropertyAssignment(
                      factory.createStringLiteral(portal.schemaName),
                      factory.createIdentifier(`Z${varname(portal.schemaName)}`)
                    )
                  ),
                  true
                ),
              ]
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    ),
    factory.createTypeAliasDeclaration(
      undefined,
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(`T${schemaName}Portals`),
      undefined,
      factory.createTypeReferenceNode(
        factory.createQualifiedName(
          factory.createIdentifier("z"),
          factory.createIdentifier("infer")
        ),
        [factory.createTypeQueryNode(factory.createIdentifier(`Z${schemaName}Portals`))]
      )
    ),
  ];

  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              undefined,
              factory.createIdentifier("z")
            ),
          ])
        ),
        factory.createStringLiteral("zod")
      ),

      // for each table, create a ZodSchema variable and inferred type
      ...buildTypeZod(schemaName, schema),

      // now the same for each portal
      ...portals,

      // if there are portals, export single portal type for the layout
      ...(portalSchema.length > 0 ? portalStatements : []),

      // now add types for any values lists
      ...vls,
    ]
  );
};

const buildTSSchema = (args: Omit<BuildSchemaArgs, "type">) => {
  const { schema, schemaName, portalSchema = [], valueLists = [] } = args;
  const portals = portalSchema.map((p) => buildTypeTS(p.schemaName, p.schema));
  const vls = valueLists.map((vl) => buildValueListTS(vl.name, vl.values));
  const portalStatement = factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`T${schemaName}Portals`),
    undefined,
    factory.createTypeLiteralNode(
      portalSchema.map((portal) =>
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier(portal.schemaName),
          undefined,
          factory.createArrayTypeNode(
            factory.createTypeReferenceNode(
              factory.createIdentifier(`T${varname(portal.schemaName)}`),
              undefined
            )
          )
        )
      )
    )
  );

  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [
      buildTypeTS(schemaName, schema),
      ...portals,
      // if there are portals, export single portal type for the layout
      ...(portalSchema.length > 0 ? [portalStatement] : []),
      ...vls,
    ]
  );
};

export const getSchema = async (args: {
  client: ReturnType<typeof DataApi>;
  layout: string;
  valueLists?: ValueListsOptions;
}) => {
  const schemaMap: F.Function<[FieldMetaData[]], TSchema[]> = (schema) =>
    schema.map((field) => {
      if (
        meta &&
        field.valueList &&
        meta.valueLists &&
        valueLists !== "ignore"
      ) {
        const list = meta.valueLists.find((o) => o.name === field.valueList);
        const values = list?.values.map((o) => o.value) ?? [];
        return {
          name: field.name,
          type: "valueList",
          values: valueLists === "allowEmpty" ? [...values, ""] : values,
        };
      }
      return {
        name: field.name,
        type: field.result === "number" ? "fmnumber" : "string",
      };
    });
  const { client, layout, valueLists = "ignore" } = args;
  const meta = await client.metadata({ layout }).catch((err) => {
    if (err instanceof FileMakerError && err.code === "105") {
      console.log(
        chalk.bold.red("ERROR:"),
        // chalk.red("Layout", chalk.underline(layout), "not found"),
        "Skipping schema generation for layout:",
        chalk.bold.underline(layout),
        "(not found)"
      );
      return;
    }
    throw err;
  });
  if (!meta) return;
  // console.log(meta);
  const schema = schemaMap(meta.fieldMetaData);
  const portalSchema = Object.keys(meta.portalMetaData).map((schemaName) => {
    const schema = schemaMap(meta.portalMetaData[schemaName]);
    return { schemaName, schema };
  });
  const valueListValues =
    meta.valueLists?.map((vl) => ({
      name: vl.name,
      values: vl.values.map((o) => o.value),
    })) ?? [];
  return { schema, portalSchema, valueLists: valueListValues };
};

export type ValueListsOptions = "strict" | "allowEmpty" | "ignore";
export type GenerateSchemaOptions = {
  clientConfig: ClientObjectProps;
  schemas: Array<{
    layout: string;
    schemaName: string;
    valueLists?: ValueListsOptions;
  }>;
  path?: string;
  useZod?: boolean;
};
export const generateSchemas = async (options: GenerateSchemaOptions) => {
  const { clientConfig, schemas, path = "schema", useZod = true } = options;
  const client = DataApi(clientConfig);
  await fs.ensureDir(path);
  schemas.forEach(async (item) => {
    const result = await getSchema({
      client,
      layout: item.layout,
      valueLists: item.valueLists,
    });
    if (result) {
      const { schema, portalSchema, valueLists } = result;
      const code = buildSchema({
        schemaName: item.schemaName,
        schema,
        portalSchema,
        valueLists,
        type: useZod ? "zod" : "ts",
      });
      fs.writeFile(join(path, `${item.schemaName}.ts`), code, () => {});
    }
  });
};