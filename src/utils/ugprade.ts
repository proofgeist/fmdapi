import type { GenerateSchemaOptions } from "./typegen/types.js";
import * as p from "@clack/prompts";
import type { TypegenConfig } from "@proofkit/typegen/config";
import { execa } from "execa";
import fs from "fs-extra";
type NewConfig = TypegenConfig["config"];

export async function upgradeConfig(
  config: GenerateSchemaOptions,
  configPath: string,
) {
  console.log();
  p.intro("🚀 Upgrading to ProofKit Typegen...");

  const confirm = await p.confirm({
    message:
      "Would you like to upgrade @proofgeist/fmdapi to @proofkit/fmdapi?",
  });

  if (!confirm) {
    p.cancel("Upgrade cancelled");
  }

  // force config to be an array
  const oldConfig = Array.isArray(config) ? config : [config];

  // ask user what package manager they are using
  const packageManager = await p.select({
    message:
      "What package manager do you want to use to install the new dependencies?",
    options: [
      { value: "pnpm", label: "pnpm" },
      { value: "npm", label: "npm" },
      { value: "yarn", label: "yarn" },
      { value: "skip", label: "skip" },
    ],
  });

  if (p.isCancel(packageManager)) {
    return p.cancel("Upgrade cancelled");
  }

  if (packageManager === "skip") {
    p.log.info("Skipping dependency installation");
  } else {
    const spinner = p.spinner();

    spinner.start("Installing dependencies...");
    // install the new dependencies
    await execa(packageManager, [
      packageManager === "npm" ? "install" : "add",
      "@proofkit/fmdapi@latest",
    ]);
    await execa(packageManager, [
      packageManager === "npm" ? "install" : "add",
      "@proofkit/typegen@latest",
      "-D",
    ]);
    await execa(packageManager, ["remove", "@proofgeist/fmdapi"]);

    if (oldConfig.some((config) => !!config.webviewerScriptName)) {
      // add @proofkit/webviewer
      await execa(packageManager, [
        packageManager === "npm" ? "install" : "add",
        "@proofkit/webviewer",
      ]);
      await execa(packageManager, ["remove", "@proofgeist/fm-webviewer-fetch"]);
    }

    spinner.stop("Dependencies installed");
  }

  const newConfig: NewConfig = oldConfig.map(
    ({ schemas, useZod, ...config }) => ({
      ...config,
      layouts: schemas.map(({ layout, ...schema }) => ({
        ...schema,
        layoutName: layout,
      })),
      validator: useZod === false ? false : "zod/v3",
    }),
  );

  const newConfigPath = "proofkit-typegen.config.jsonc";

  await fs.writeJSON(
    newConfigPath,
    {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: newConfig,
    },
    {
      spaces: 2,
    },
  );

  // remove the old config
  await fs.remove(configPath);

  p.log.step("Running the new typegen...");
  // run the new typegen using npx
  await execa("npx", ["@proofkit/typegen@latest", "--reset-overrides"], {
    stdio: "inherit",
  });

  p.note(`Next Steps:
  
  - Run tsc to check for other errors. You may need to update any references from @proofgeist/fmdapi to @proofkit/fmdapi.
  - To run typegen in the future, run \`npx @proofkit/typegen@latest\` or add a script to your package.json`);
  p.outro("✅ Upgrade complete!");
}
