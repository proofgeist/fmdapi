#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { generateSchemas } from "./utils";
import path from "path";
import { GenerateSchemaOptions } from "./utils/codegen";
import { config } from "dotenv";

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
      path.resolve(__dirname, "../stubs/fmschema.config.stub.js"),
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

  const { config }: { config: GenerateSchemaOptions } = await import(
    configLocation
  );
  await generateSchemas(config, configLocation).catch((err) => {
    console.error(err);
  });
  console.log(`✅ Generated schemas\n`);
}

program
  .option("--init", "Add the configuration file to your project")
  .option(
    "--config <filename>",
    "optional config file name",
    "./fmschema.config.js" // default
  )
  .option("--env-path <path>", "optional path to your .env file", ".env.local")
  .option(
    "--skip-env-check",
    "Ignore loading environment variables from a file.",
    false
  )
  .action(async (options) => {
    const configLocation = path.resolve(options.config);
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
