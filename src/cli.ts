#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { generateSchemas } from "./utils";
import path from "path";
import { GenerateSchemaOptions } from "./utils/codegen";
import { config } from "dotenv";

const defaultConfigPaths = ["./fmschema.config.mjs", "./fmschema.config.js"];
type ConfigArgs = {
  configLocation: string;
};

function init({ configLocation }: ConfigArgs) {
  console.log();
  if (fs.existsSync(configLocation)) {
    console.log(
      chalk.yellow(`⚠️ ${path.basename(configLocation)} already exists`)
    );
  } else {
    const stubFile = fs.readFileSync(
      path.resolve(__dirname, "../stubs/fmschema.config.stub.mjs"),
      "utf8"
    );
    fs.writeFileSync(configLocation, stubFile, "utf8");
    console.log(`✅ Created config file: ${path.basename(configLocation)}`);
  }
}

async function runCodegen({ configLocation }: ConfigArgs) {
  if (!fs.existsSync(configLocation)) {
    console.error(
      chalk.red(
        `Could not find ${path.basename(
          configLocation
        )} at the root of your project.`
      )
    );
    console.log();
    console.log("run `codegen --init` to create a new config file");
    return process.exit(1);
  }
  await fs.access(configLocation, fs.constants.R_OK).catch(() => {
    console.error(
      chalk.red(
        `You do not have read access to ${path.basename(
          configLocation
        )} at the root of your project.`
      )
    );
    return process.exit(1);
  });

  let config;

  try {
    const module: { config: GenerateSchemaOptions } = await import(
      configLocation
    );
    config = module.config;
  } catch {
    /* empty */
  }

  if (!config) {
    config = require(configLocation);
  }
  if (!config) {
    console.error(
      chalk.red(
        `Error reading the config object from ${path.basename(
          configLocation
        )}. Are you sure you have a "config" object exported?`
      )
    );
  }
  await generateSchemas(config, configLocation).catch((err) => {
    console.error(err);
    return process.exit(1);
  });
  console.log(`✅ Generated schemas\n`);
}

program
  .option("--init", "Add the configuration file to your project")
  .option("--config <filename>", "optional config file name")
  .option("--env-path <path>", "optional path to your .env file", ".env.local")
  .option(
    "--skip-env-check",
    "Ignore loading environment variables from a file.",
    false
  )
  .action(async (options) => {
    // check if options.config resolves to a file

    const configPath = getConfigPath(options.config);
    const configLocation = path.resolve(configPath ?? defaultConfigPaths[0]);
    if (options.init) return init({ configLocation });

    if (!options.skipEnvCheck) {
      const envRes = config({ path: options.envPath });
      if (envRes.error)
        return console.log(
          chalk.red(
            `Could not resolve your environment variables.\n${envRes.error.message}\n`
          )
        );
    }

    // default command
    await runCodegen({ configLocation });
  });

program.parse();

function getConfigPath(configPath?: string): string | null {
  if (configPath) {
    // If a config path is specified, check if it exists
    try {
      fs.accessSync(configPath, fs.constants.F_OK);
      return configPath;
    } catch (e) {
      // If it doesn't exist, continue to default paths
    }
  }

  // Try default paths in order
  for (const path of defaultConfigPaths) {
    try {
      fs.accessSync(path, fs.constants.F_OK);
      return path;
    } catch (e) {
      // If path doesn't exist, try the next one
    }
  }
  return null;
}
