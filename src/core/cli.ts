import fs from "node:fs/promises";
import { Command } from "commander";
import { resolveConfig } from "./config.js";
import { CliError, EXIT_CODES } from "./errors.js";
import { errorEnvelope, successEnvelope, writeJson } from "./output.js";
import { readStdin } from "./utils.js";
import { validateAgainstSchema } from "./schema.js";
import { buildHelpTree } from "./help.js";

export type GlobalOptions = {
  token?: string;
  tokenStdin?: boolean;
  profile?: string;
  notionVersion?: string;
  timeout?: number;
  retries?: number;
  outputFile?: string;
  pretty?: boolean;
  ndjson?: boolean;
  validate?: boolean;
  debug?: boolean;
  verbose?: boolean;
  quiet?: boolean;
};

export type Context = {
  command: string;
  config: Awaited<ReturnType<typeof resolveConfig>>;
  outputFile?: string;
  pretty: boolean;
  ndjson: boolean;
  validate: boolean;
};

export type ActionResult<T> = {
  data: T;
  exitCode?: number;
};

export async function resolveContext(
  commandName: string,
  options: GlobalOptions
): Promise<Context> {
  let stdinToken: string | null = null;
  if (options.tokenStdin) {
    stdinToken = (await readStdin()).trim() || null;
  }

  const config = await resolveConfig({
    token: options.token,
    tokenStdin: options.tokenStdin,
    profile: options.profile,
    notionVersion: options.notionVersion,
    timeoutMs: options.timeout,
    retries: options.retries,
    pretty: options.pretty,
    stdinToken
  });

  return {
    command: commandName,
    config,
    outputFile: options.outputFile,
    pretty: options.pretty ?? config.pretty,
    ndjson: options.ndjson ?? false,
    validate: options.validate ?? true
  };
}

export function requireToken(config: Context["config"]): string {
  if (!config.token) {
    throw new CliError("AUTH_FAILED", "Missing Notion token", {
      recoverable: false,
      suggestedAction: "Provide --token, --token-stdin, or NOTION_TOKEN"
    });
  }
  return config.token;
}

export async function emitOutput(ctx: Context, envelope: unknown): Promise<void> {
  writeJson(envelope, ctx.pretty);
  if (ctx.outputFile) {
    await fs.writeFile(
      ctx.outputFile,
      JSON.stringify(envelope, null, ctx.pretty ? 2 : 0),
      "utf8"
    );
  }
}

export async function runAction<T>(
  command: string,
  options: GlobalOptions,
  handler: (ctx: Context) => Promise<ActionResult<T>>,
  stdinInputs: Array<string | undefined> = [],
  cmd?: Command
): Promise<void> {
  const mergedOptions =
    cmd && typeof cmd.optsWithGlobals === "function"
      ? (cmd.optsWithGlobals() as GlobalOptions)
      : options;
  const start = Date.now();
  try {
    await ensureTokenStdinSafe(mergedOptions, stdinInputs);
    const ctx = await resolveContext(command, mergedOptions);
    const result = await handler(ctx);
    if (!(ctx.ndjson && (result.data as any)?.streamed === true)) {
      const envelope = successEnvelope(command, result.data, [], {
        duration_ms: Date.now() - start
      });
      await emitOutput(ctx, envelope);
    }
    process.exit(result.exitCode ?? EXIT_CODES.SUCCESS);
  } catch (error) {
    await handleError(command, error, start, mergedOptions);
  }
}

export async function handleError(
  command: string,
  error: unknown,
  start: number,
  options: GlobalOptions
): Promise<void> {
  const ctx = await resolveContext(command, options);
  let cliError: CliError;

  if (error instanceof CliError) {
    cliError = error;
  } else if (error instanceof Error) {
    cliError = new CliError("INTERNAL_ERROR", error.message, { recoverable: false });
  } else {
    cliError = new CliError("INTERNAL_ERROR", "Unknown error", { recoverable: false });
  }

  const envelope = errorEnvelope(
    command,
    {
      code: cliError.code,
      message: cliError.message,
      recoverable: cliError.recoverable,
      suggested_action: cliError.suggestedAction,
      context: cliError.context
    },
    { duration_ms: Date.now() - start }
  );

  await emitOutput(ctx, envelope);
  if (!options.quiet) {
    process.stderr.write(`${cliError.code}: ${cliError.message}\n`);
  }
  process.exit(EXIT_CODES[cliError.code] ?? EXIT_CODES.INTERNAL_ERROR);
}

export function helpJson(program: Command): void {
  writeJson(buildHelpTree(program), true);
}

export async function validateInput(
  ctx: Context,
  schema: string,
  data: unknown
): Promise<void> {
  if (!ctx.validate || data === null || data === undefined) return;
  const result = await validateAgainstSchema(schema, data);
  if (result && !result.valid) {
    throw new CliError("INVALID_ARGUMENT", "Input validation failed", {
      recoverable: true,
      suggestedAction: "Fix the input to match the schema",
      context: { errors: result.errors }
    });
  }
}

export function parseId(positional: string | undefined, flagValue?: string): string {
  return flagValue ?? positional ?? "";
}

export async function ensureTokenStdinSafe(
  options: GlobalOptions,
  inputs: Array<string | undefined>
): Promise<void> {
  if (!options.tokenStdin) return;
  if (inputs.some((value) => value === "-")) {
    throw new CliError("INVALID_ARGUMENT", "--token-stdin cannot be used with stdin JSON input", {
      recoverable: true,
      suggestedAction: "Use --token or avoid '-' JSON inputs",
      context: { conflict: "stdin" }
    });
  }
}
