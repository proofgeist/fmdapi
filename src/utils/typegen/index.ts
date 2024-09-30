import { Project, ScriptKind } from 'ts-morph';
import {
  BuildSchemaArgs,
  ClientObjectProps,
  GenerateSchemaOptions,
} from './types.js';
import chalk from 'chalk';
import { isOttoAuth, OttoAdapter, OttoAPIKey } from '../../adapters/otto.js';
import DataApi from '../../client.js';
import { FetchAdapter } from '../../adapters/fetch.js';
import { memoryStore } from '../../tokenStore/index.js';
import fs from 'fs-extra';
import path from 'path';
import { commentHeader } from './constants.js';
import { buildSchema } from './buildSchema.js';
import { getLayoutMetadata } from './getLayoutMetadata.js';
import { buildLayoutClient } from './buildLayoutClient.js';

export const generateTypedClients = async (
  options: GenerateSchemaOptions,
  configLocation?: string,
) => {
  const {
    envNames,
    schemas,

    useZod = true,
    generateClient = true,
    webviewerScriptName,
    ...rest
  } = options;

  const rootDir = rest.path ?? 'schema';

  const defaultEnvNames = {
    apiKey: 'OTTO_API_KEY',
    ottoPort: 'OTTO_PORT',
    username: 'FM_USERNAME',
    password: 'FM_PASSWORD',
    server: 'FM_SERVER',
    db: 'FM_DATABASE',
  };

  const project = new Project({});

  if (webviewerScriptName !== undefined && !!options.tokenStore)
    console.log(
      `${chalk.yellow(
        'NOTE:',
      )} The webviewer client does not store any tokens. The tokenStore option will be ignored.`,
    );

  // if (configLocation) {
  //   getTokenStoreFromConfig(configLocation);
  //   return;
  // }

  const server = process.env[envNames?.server ?? defaultEnvNames.server];
  const db = process.env[envNames?.db ?? defaultEnvNames.db];
  const apiKey =
    (envNames?.auth && isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.apiKey ?? defaultEnvNames.apiKey]
      : undefined) ?? process.env[defaultEnvNames.apiKey];
  const username =
    (envNames?.auth && !isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.username ?? defaultEnvNames.username]
      : undefined) ?? process.env[defaultEnvNames.username];
  const password =
    (envNames?.auth && !isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.password ?? defaultEnvNames.password]
      : undefined) ?? process.env[defaultEnvNames.password];

  const auth: ClientObjectProps['auth'] = apiKey
    ? { apiKey: apiKey as OttoAPIKey }
    : { username: username ?? '', password: password ?? '' };

  if (!server || !db || (!apiKey && !username)) {
    console.log(chalk.red('ERROR: Could not get all required config values'));
    console.log('Ensure the following environment variables are set:');
    if (!server) console.log(`${envNames?.server ?? defaultEnvNames.server}`);
    if (!db) console.log(`${envNames?.db ?? defaultEnvNames.db}`);
    if (!apiKey)
      console.log(
        `${
          (envNames?.auth &&
            isOttoAuth(envNames.auth) &&
            envNames.auth.apiKey) ??
          defaultEnvNames.apiKey
        } (or ${
          (envNames?.auth &&
            !isOttoAuth(envNames.auth) &&
            envNames.auth.username) ??
          defaultEnvNames.username
        } and ${
          (envNames?.auth &&
            !isOttoAuth(envNames.auth) &&
            envNames.auth.password) ??
          defaultEnvNames.password
        })`,
      );

    console.log();
    return;
  }

  const client = isOttoAuth(auth)
    ? DataApi({
        adapter: new OttoAdapter({ auth, server, db }),
      })
    : DataApi({
        adapter: new FetchAdapter({
          auth,
          server,
          db,
          tokenStore: memoryStore(),
        }),
      });
  await fs.ensureDir(rootDir);

  for await (const item of schemas) {
    const result = await getLayoutMetadata({
      client,
      layout: item.layout,
      valueLists: item.valueLists,
    });
    if (!result) continue;

    const { schema, portalSchema, valueLists } = result;
    const args: BuildSchemaArgs = {
      schemaName: item.schemaName,
      schema,
      layoutName: item.layout,
      portalSchema,
      valueLists,
      type: useZod ? 'zod' : 'ts',
      strictNumbers: item.strictNumbers,
      configLocation,
      webviewerScriptName: options.webviewerScriptName,
      envNames: {
        auth: isOttoAuth(auth)
          ? {
              apiKey:
                envNames?.auth && 'apiKey' in envNames.auth
                  ? envNames.auth.apiKey
                  : (defaultEnvNames.apiKey as OttoAPIKey),
            }
          : {
              username:
                envNames?.auth && 'username' in envNames.auth
                  ? envNames.auth.username
                  : defaultEnvNames.username,
              password:
                envNames?.auth && 'password' in envNames.auth
                  ? envNames.auth.password
                  : defaultEnvNames.password,
            },
        db: envNames?.db ?? defaultEnvNames.db,
        server: envNames?.server ?? defaultEnvNames.server,
      },
    };
    const schemaFile = project.createSourceFile(
      path.join(rootDir, `${item.schemaName}.ts`),
      { leadingTrivia: commentHeader },
      {
        overwrite: true,
        scriptKind: ScriptKind.TS,
      },
    );
    buildSchema(schemaFile, args);

    if (item.generateClient ?? generateClient) {
      await fs.ensureDir(path.join(rootDir, 'client'));
      const layoutClientFile = project.createSourceFile(
        path.join(rootDir, 'client', `${item.schemaName}.ts`),
        { leadingTrivia: commentHeader },
        {
          overwrite: true,
          scriptKind: ScriptKind.TS,
        },
      );
      buildLayoutClient(layoutClientFile, args);

      const clientIndexFilePath = path.join(rootDir, 'client', 'index.ts');

      fs.ensureFile(clientIndexFilePath);
      const clientIndexFile = project.addSourceFileAtPath(clientIndexFilePath);
      clientIndexFile.addExportDeclaration({
        namedExports: [{ name: 'client', alias: `${item.schemaName}Layout` }],
        moduleSpecifier: `./${item.schemaName}`,
      });
    }
  }

  await project.save();
};
