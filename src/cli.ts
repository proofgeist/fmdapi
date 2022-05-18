#!/usr/bin/env node
import { Command, program } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { generateSchemas } from "./utils";
import path from "path";
import { GenerateSchemaOptions } from "./utils/codegen";

const configLocation = path.resolve(`./fmschema.config.js`);

const codegen = new Command("run");
codegen.action(async () => {
  if (!fs.existsSync(configLocation)) {
    console.error(
      chalk.red(
        `Could not find ${path.basename(
          configLocation
        )} at the root of your project.`
      )
    );
    console.log();
    console.log("run `codegen init` to create a new config file");
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

  const config: GenerateSchemaOptions = require(configLocation);
  await generateSchemas(config).catch((err) => {
    console.error(err);
  });
});

const init = new Command("init");
init.action(() => {
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
});

program.addCommand(codegen).addCommand(init).parse();

export { codegen, init };
