import { CodeBlockWriter, SourceFile, VariableDeclarationKind } from "ts-morph";
import { type BuildSchemaArgs } from "./types.js";
import { isOttoAuth } from "../../adapters/otto.js";

export function buildLayoutClient(
  sourceFile: SourceFile,
  args: BuildSchemaArgs,
) {
  const {
    schemaName,
    portalSchema,
    envNames,
    type,
    webviewerScriptName,
    layoutName,
  } = args;
  const fmdapiImport = sourceFile.addImportDeclaration({
    moduleSpecifier: "@proofgeist/fmdapi",
    namedImports: ["DataApi"],
  });
  const hasPortals = (portalSchema ?? []).length > 0;
  if (webviewerScriptName) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: `@proofgeist/fm-webviewer-fetch/adapter`,
      namedImports: ["WebViewerAdapter"],
    });
  } else if (isOttoAuth(envNames.auth)) {
    // if otto, add the OttoAdapter and OttoAPIKey imports
    fmdapiImport.addNamedImports([
      { name: "OttoAdapter" },
      { name: "OttoAPIKey", isTypeOnly: true },
    ]);
  } else {
    fmdapiImport.addNamedImport({ name: "FetchAdapter" });
  }

  // import the types
  const schemaImport = sourceFile.addImportDeclaration({
    moduleSpecifier: `../${schemaName}`,
    namedImports: [`T${schemaName}`],
  });
  if (type === "zod") schemaImport.addNamedImport(`Z${schemaName}`);

  // add portal imports
  if (hasPortals) {
    schemaImport.addNamedImport(`T${schemaName}Portals`);
    if (type === "zod") schemaImport.addNamedImport(`Z${schemaName}Portals`);
  }

  if (!webviewerScriptName) {
    addTypeGuardStatements(sourceFile, { envVarName: envNames.db });
    addTypeGuardStatements(sourceFile, { envVarName: envNames.server });
    if (isOttoAuth(envNames.auth)) {
      addTypeGuardStatements(sourceFile, { envVarName: envNames.auth.apiKey });
    } else {
      addTypeGuardStatements(sourceFile, {
        envVarName: envNames.auth.username,
      });
      addTypeGuardStatements(sourceFile, {
        envVarName: envNames.auth.password,
      });
    }
  }

  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    declarations: [
      {
        name: "client",
        initializer: (writer) => {
          writer
            .write(
              `DataApi<any, T${schemaName}${
                hasPortals ? `, T${schemaName}Portals` : ""
              }>(`,
            )
            .inlineBlock(() => {
              writer.write(`adapter: `);
              buildAdapter(writer, args);
              writer.write(",").newLine();
              writer.write(`layout: `).quote(layoutName).write(`,`).newLine();
              if (type === "zod") {
                writer.writeLine(
                  `zodValidators: { fieldData: Z${schemaName}${
                    hasPortals ? `, portalData: Z${schemaName}Portals` : ""
                  } },`,
                );
              }
            })
            .write(")");
        },
      },
    ],
  });

  //   sourceFile.addExportAssignment({ isExportEquals: true, expression: "" });
}

function addTypeGuardStatements(
  sourceFile: SourceFile,
  { envVarName }: { envVarName: string },
) {
  sourceFile.addStatements((writer) => {
    writer.writeLine(
      `if (!process.env.${envVarName}) throw new Error("Missing env var: ${envVarName}")`,
    );
  });
}

function buildAdapter(writer: CodeBlockWriter, args: BuildSchemaArgs): string {
  const { envNames, tokenStore, webviewerScriptName } = args;

  if (webviewerScriptName) {
    writer.write(`new WebViewerAdapter({scriptName: `);
    writer.quote(webviewerScriptName);
    writer.write("})");
  } else if (isOttoAuth(envNames.auth)) {
    writer
      .write(`new OttoAdapter(`)
      .inlineBlock(() => {
        if (!isOttoAuth(envNames.auth)) return;
        writer
          .write(
            `auth: { apiKey: process.env.${envNames.auth.apiKey} as OttoAPIKey }`,
          )
          .write(",")
          .newLine();
        writer.write(`db: process.env.${envNames.db}`).write(",").newLine();
        writer
          .write(`server: process.env.${envNames.server}`)
          .write(",")
          .newLine();
      })
      .write(`)`);
  } else {
    writer
      .write(`new FetchAdapter({`)
      .inlineBlock(() => {
        if (isOttoAuth(envNames.auth)) return;
        writer
          .writeLine(`auth:`)
          .inlineBlock(() => {
            if (isOttoAuth(envNames.auth)) return;
            writer
              .write(`username: process.env.${envNames.auth.username}`)
              .write(",")
              .newLine();
            writer.write(`password: process.env.${envNames.auth.password}`);
          })
          .write(",")
          .writeLine(`db: process.env.${envNames.db},`)
          .writeLine(`server: process.env.${envNames.server}`);
      })
      .write(")");
  }

  return writer.toString();
}
