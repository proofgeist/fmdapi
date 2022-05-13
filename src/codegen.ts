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
    type === "zod"
      ? buildZodSchema(schemaName, schema)
      : buildTSSchema(schemaName, schema);
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
                      factory.createPropertyAssignment(
                        factory.createIdentifier(item.name),
                        factory.createCallExpression(
                          factory.createPropertyAccessExpression(
                            factory.createIdentifier("z"),
                            factory.createIdentifier(item.type)
                          ),
                          undefined,
                          []
                        )
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
        undefined,
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
  layout: string
) => {
  const meta = await client.metadata({ layout });
  // console.log(meta);
  const schema = meta.fieldMetaData.map<TSchema>((field) => {
    if (field.valueList && meta.valueLists) {
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
  schemas: Array<{ layout: string; schemaName: string }>;
  path?: string;
}) => {
  const { client, schemas, path = "schema" } = options;
  await fs.ensureDir(path);
  schemas.forEach(async (item) => {
    const schema = await getSchema(client, item.layout);
    const code = buildZodSchema(item.schemaName, schema);
    fs.writeFile(join(path, `${item.schemaName}.ts`), code, () => {});
  });
};
