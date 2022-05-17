#!/usr/bin/env node
import { program } from "commander";

program
  .command("init")
  .action(() => {
    console.log("Hello World");
  })
  .parse();

export {};
