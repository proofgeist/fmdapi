import fs, { writeFile } from "fs-extra";
import { join } from "path";
import ts, { factory, createSourceFile, createPrinter } from "typescript";
import fmDAPI from ".";

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
export const buildSchema = (
  schemaName: string,
  schema: Array<TSchema>,
  type: "zod" | "ts"
) => {
  // make sure schema has unique keys, in case a field is on the layout mulitple times
  schema = schema.reduce(
    (acc: TSchema[], el) =>
      acc.find((o) => o.name === el.name)
        ? acc
        : ([...acc, el] as Array<TSchema>),
    []
  );
  const printer = createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const file =
    type === "ts"
      ? buildTSSchema(schemaName, schema)
      : buildZodSchema(schemaName, schema);
  return printer.printFile(file);
};

const buildZodSchema = (schemaName: string, schema: Array<TSchema>) => {
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
          [
            factory.createTypeQueryNode(
              factory.createIdentifier(`Z${schemaName}`)
            ),
          ]
        )
      ),
    ]
  );
};

const buildTSSchema = (schemaName: string, schema: Array<TSchema>) => {
  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [
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
      ),
    ]
  );
};

export const getSchema = async (
  client: ReturnType<typeof fmDAPI>,
  layout: string,
  strictValueLists = false
) => {
  const meta = await client.metadata({ layout });
  console.log(meta);
  const schema = meta.fieldMetaData.map<TSchema>((field) => {
    if (field.valueList && meta.valueLists && strictValueLists) {
      const list = meta.valueLists.find((o) => o.name === field.valueList);
      return {
        name: field.name,
        type: "valueList",
        values: list?.values.map((o) => o.value),
      };
    }
    return {
      name: field.name,
      type: field.result === "number" ? "fmnumber" : "string",
    };
  });
  return schema;
};

export const generateSchemas = async (options: {
  client: ReturnType<typeof fmDAPI>;
  schemas: Array<{
    layout: string;
    schemaName: string;
    strictValueLists?: boolean;
  }>;
  path?: string;
  useZod?: boolean;
}) => {
  const { client, schemas, path = "schema", useZod = true } = options;
  await fs.ensureDir(path);
  schemas.forEach(async (item) => {
    const schema = await getSchema(client, item.layout, item.strictValueLists);
    const code = buildSchema(item.schemaName, schema, useZod ? "zod" : "ts");
    fs.writeFile(join(path, `${item.schemaName}.ts`), code, () => {});
  });
};
