#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommanderError } from "commander";
import { EXIT_CODES, CliError } from "./core/errors.js";
import { readJsonInput } from "./core/utils.js";
import {
  helpJson,
  handleError,
  runAction,
  parseId,
  requireToken,
  validateInput
} from "./core/cli.js";
import { formatHelp } from "./core/help.js";
import { registerCommands } from "./commands/commands.js";
import { CommandHelpers } from "./commands/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_ROOT = path.join(__dirname, "..", "schemas");

function schemaPath(name: string): string {
  return path.join(SCHEMA_ROOT, name);
}

function globalOptions(command: Command): void {
  command
    .option("--token <token>", "Notion integration token")
    .option("--token-stdin", "Read token from stdin")
    .option("--profile <profile>", "Config profile")
    .option("--notion-version <version>", "Notion API version")
    .option("--timeout <ms>", "Timeout in ms", (value) => Number(value))
    .option("--retries <count>", "Retry count", (value) => Number(value))
    .option("--output-file <path>", "Write output to file")
    .option("--pretty", "Pretty-print JSON output")
    .option("--ndjson", "Stream NDJSON output for paginated results")
    .option("--no-validate", "Disable input validation")
    .option("--debug", "Enable debug logs")
    .option("--verbose", "Enable verbose logs")
    .option("--quiet", "Suppress stderr logs")
    .option("--help-json", "Print help in JSON format and exit");
}

async function run(): Promise<void> {
  const program = new Command();
  program.name("notion").description("Notion CLI for coding agents");
  program.version("1.0.0");
  program.showHelpAfterError(false);
  program.exitOverride();

  globalOptions(program);
  program.configureHelp({
    formatHelp: (cmd, helper) => formatHelp(cmd, helper)
  });

  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpJson) {
      helpJson(program);
      process.exit(0);
    }
  });

  const helpers: CommandHelpers = {
    runAction,
    requireToken,
    parseId,
    validateInput,
    schemaPath,
    readJsonInput
  };

  registerCommands(program, helpers);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return;
      }
      const cliError = new CliError("INVALID_ARGUMENT", error.message, {
        recoverable: true,
        suggestedAction: "Check --help for valid commands and flags"
      });
      await handleError("notion", cliError, Date.now(), {} as any);
      return;
    }
    throw error;
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`INTERNAL_ERROR: ${message}\n`);
  process.exit(EXIT_CODES.INTERNAL_ERROR);
});
