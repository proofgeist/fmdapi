import fs, { writeFile } from "fs-extra";
import { join } from "path";
import ts, {
  factory,
  createSourceFile,
  createPrinter,
  Statement,
} from "typescript";
import fmDAPI from ".";
import { FieldMetaData } from "./client-types";
import { F } from "ts-toolbelt";

type TSchema = {
  name: string;
  type: "string" | "fmnumber" | "valueList";
  values?: string[];
};

const stringProperty = (name: string) =>
  factory.createPropertySignature(
    undefined,
    factory.createIdentifier(name),
    undefined,
    factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  );
const stringPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createIdentifier(name),
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
    factory.createIdentifier(name),
    undefined,
    factory.createUnionTypeNode([
      factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ])
  );
const stringOrNumberPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createIdentifier(name),
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
    factory.createIdentifier(name),
    undefined,
    factory.createUnionTypeNode(
      vl.map((v) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(v))
      )
    )
  );
const valueListPropertyZod = (name: string, vl: string[]) =>
  factory.createPropertyAssignment(
    factory.createIdentifier(name),
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
          factory.createIdentifier(`Z${schemaName}`),
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
    factory.createIdentifier(`T${schemaName}`),
    undefined,
    factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier("z"),
        factory.createIdentifier("infer")
      ),
      [factory.createTypeQueryNode(factory.createIdentifier(`Z${schemaName}`))]
    )
  ),
];
const buildValueListZod = (name: string, values: string[]): Statement[] => [
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(`ZVL${name}`),
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
    factory.createIdentifier(`TVL${name}`),
    undefined,
    factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier("z"),
        factory.createIdentifier("infer")
      ),
      [factory.createTypeQueryNode(factory.createIdentifier(`ZVL${name}`))]
    )
  ),
];
const buildValueListTS = (name: string, values: string[]): Statement =>
  factory.createTypeAliasDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(`TVL${name}`),
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
    factory.createIdentifier(`T${schemaName}`),
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
  return printer.printFile(file);
};

const buildZodSchema = (args: Omit<BuildSchemaArgs, "type">) => {
  const { schema, schemaName, portalSchema = [], valueLists = [] } = args;
  const portals = portalSchema
    .map((p) => buildTypeZod(p.schemaName, p.schema))
    .flat();
  const vls = valueLists
    .map((vl) => buildValueListZod(vl.name, vl.values))
    .flat();

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

      // now add types for any values lists
      ...vls,
    ]
  );
};

const buildTSSchema = (args: Omit<BuildSchemaArgs, "type">) => {
  const { schema, schemaName, portalSchema = [], valueLists = [] } = args;
  const portals = portalSchema.map((p) => buildTypeTS(p.schemaName, p.schema));
  const vls = valueLists.map((vl) => buildValueListTS(vl.name, vl.values));

  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [buildTypeTS(schemaName, schema), ...portals, ...vls]
  );
};

export const getSchema = async (args: {
  client: ReturnType<typeof fmDAPI>;
  layout: string;
  valueLists?: ValueListsOptions;
}) => {
  const schemaMap: F.Function<[FieldMetaData[]], TSchema[]> = (schema) =>
    schema.map((field) => {
      if (field.valueList && meta.valueLists && valueLists !== "ignore") {
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
  const meta = await client.metadata({ layout });
  console.log(meta);
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
export const generateSchemas = async (options: {
  client: ReturnType<typeof fmDAPI>;
  schemas: Array<{
    layout: string;
    schemaName: string;
    valueLists?: ValueListsOptions;
  }>;
  path?: string;
  useZod?: boolean;
}) => {
  const { client, schemas, path = "schema", useZod = true } = options;
  await fs.ensureDir(path);
  schemas.forEach(async (item) => {
    const { schema, portalSchema, valueLists } = await getSchema({
      client,
      layout: item.layout,
      valueLists: item.valueLists,
    });
    const code = buildSchema({
      schemaName: item.schemaName,
      schema,
      portalSchema,
      valueLists,
      type: useZod ? "zod" : "ts",
    });
    fs.writeFile(join(path, `${item.schemaName}.ts`), code, () => {});
  });
};
