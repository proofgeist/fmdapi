import fs, { writeFile } from "fs-extra";
import ts, { factory, createSourceFile, createPrinter } from "typescript";

const schemaName = "Customer";

fs.ensureDirSync("schema");

const printer = createPrinter({ newLine: ts.NewLineKind.LineFeed });
const file = factory.updateSourceFile(
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
                  [
                    // for each field, create a z property
                    factory.createPropertyAssignment(
                      factory.createIdentifier("name"),
                      factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                          factory.createIdentifier("z"),
                          factory.createIdentifier("string")
                        ),
                        undefined,
                        []
                      )
                    ),
                  ],
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

writeFile(
  `./schema/${schemaName.toLowerCase()}.ts`,
  printer.printFile(file),
  () => {}
);
