import fs from "node:fs/promises";
import { resolveConfig } from "./config.js";
import { CliError, EXIT_CODES } from "./errors.js";
import { errorEnvelope, successEnvelope, writeJson } from "./output.js";
import { readStdin } from "./utils.js";
import { validateAgainstSchema } from "./schema.js";
import { buildHelpTree } from "./help.js";
export async function resolveContext(commandName, options) {
    let stdinToken = null;
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
export function requireToken(config) {
    if (!config.token) {
        throw new CliError("AUTH_FAILED", "Missing Notion token", {
            recoverable: false,
            suggestedAction: "Provide --token, --token-stdin, or NOTION_TOKEN"
        });
    }
    return config.token;
}
export async function emitOutput(ctx, envelope) {
    writeJson(envelope, ctx.pretty);
    if (ctx.outputFile) {
        await fs.writeFile(ctx.outputFile, JSON.stringify(envelope, null, ctx.pretty ? 2 : 0), "utf8");
    }
}
export async function runAction(command, options, handler, stdinInputs = []) {
    const start = Date.now();
    try {
        await ensureTokenStdinSafe(options, stdinInputs);
        const ctx = await resolveContext(command, options);
        const result = await handler(ctx);
        if (!(ctx.ndjson && result.data?.streamed === true)) {
            const envelope = successEnvelope(command, result.data, [], {
                duration_ms: Date.now() - start
            });
            await emitOutput(ctx, envelope);
        }
        process.exit(result.exitCode ?? EXIT_CODES.SUCCESS);
    }
    catch (error) {
        await handleError(command, error, start, options);
    }
}
export async function handleError(command, error, start, options) {
    const ctx = await resolveContext(command, options);
    let cliError;
    if (error instanceof CliError) {
        cliError = error;
    }
    else if (error instanceof Error) {
        cliError = new CliError("INTERNAL_ERROR", error.message, { recoverable: false });
    }
    else {
        cliError = new CliError("INTERNAL_ERROR", "Unknown error", { recoverable: false });
    }
    const envelope = errorEnvelope(command, {
        code: cliError.code,
        message: cliError.message,
        recoverable: cliError.recoverable,
        suggested_action: cliError.suggestedAction,
        context: cliError.context
    }, { duration_ms: Date.now() - start });
    await emitOutput(ctx, envelope);
    if (!options.quiet) {
        process.stderr.write(`${cliError.code}: ${cliError.message}\n`);
    }
    process.exit(EXIT_CODES[cliError.code] ?? EXIT_CODES.INTERNAL_ERROR);
}
export function helpJson(program) {
    writeJson(buildHelpTree(program), true);
}
export async function validateInput(ctx, schema, data) {
    if (!ctx.validate || data === null || data === undefined)
        return;
    const result = await validateAgainstSchema(schema, data);
    if (result && !result.valid) {
        throw new CliError("INVALID_ARGUMENT", "Input validation failed", {
            recoverable: true,
            suggestedAction: "Fix the input to match the schema",
            context: { errors: result.errors }
        });
    }
}
export function parseId(positional, flagValue) {
    return flagValue ?? positional ?? "";
}
export async function ensureTokenStdinSafe(options, inputs) {
    if (!options.tokenStdin)
        return;
    if (inputs.some((value) => value === "-")) {
        throw new CliError("INVALID_ARGUMENT", "--token-stdin cannot be used with stdin JSON input", {
            recoverable: true,
            suggestedAction: "Use --token or avoid '-' JSON inputs",
            context: { conflict: "stdin" }
        });
    }
}
