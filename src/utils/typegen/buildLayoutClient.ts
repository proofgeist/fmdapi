import { CodeBlockWriter, SourceFile, VariableDeclarationKind } from "ts-morph";
import { type BuildSchemaArgs } from "./types.js";
import { isOttoAuth } from "../../adapters/otto.js";

export function buildLayoutClient(
  sourceFile: SourceFile,
  args: BuildSchemaArgs,
) {
  console.log("buildLayoutClient", args);
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
            .writeLine(
              `DataApi<any, T${schemaName}${
                hasPortals ? ", T${schemaName}Portals" : ""
              }>({`,
            )
            .block(() => {
              writer.writeLine(`adapter: ${buildAdapter(writer, args)},`);
              writer.writeLine(`layout: ${writer.quote(layoutName)},`);
              if (type === "zod") {
                writer.writeLine(
                  `zodValidators: { fieldData: Z${schemaName}${
                    hasPortals ? ", portalData: Z${schemaName}Portals" : ""
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

function buildAdapter(writer: CodeBlockWriter, args: BuildSchemaArgs) {
  const { envNames, tokenStore, webviewerScriptName } = args;

  if (webviewerScriptName) {
    writer.write(
      `new WebViewerAdapter({scriptName: ${writer.quote(webviewerScriptName)})`,
    );
  } else if (isOttoAuth(envNames.auth)) {
    writer
      .write(`new OttoAdapter(`)
      .block(() => {
        if (!isOttoAuth(envNames.auth)) return;
        writer
          .write(
            `auth: { apiKey: process.env.${envNames.auth.apiKey} as OttoAPIKey }`,
          )
          .write(",");
        writer.write(`db: process.env.${envNames.db}`).write(",");
        writer.write(`server: process.env.${envNames.server}`).write(",");
      })
      .write(`)`);
  } else {
    writer
      .write(`new FetchAdapter({`)
      .block(() => {
        if (isOttoAuth(envNames.auth)) return;
        writer
          .writeLine(`auth:`)
          .block(() => {
            if (isOttoAuth(envNames.auth)) return;
            writer
              .write(`username: process.env.${envNames.auth.username}`)
              .write(",");
            writer.write(`password: process.env.${envNames.auth.password}`);
          })
          .write(",")
          .writeLine(`db: process.env.${envNames.db},`)
          .writeLine(`server: process.env.${envNames.server}`);
      })
      .write(")");
  }
}
