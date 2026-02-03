import { Command } from "commander";
import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { CommandHelpers } from "./utils.js";

export function registerDatabases(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, parseId, readJsonInput, validateInput, schemaPath } = helpers;

  const databases = program.command("databases").description("Databases endpoints");

  databases
    .command("get [database_id]")
    .description("Get database")
    .option("--id <id>", "Database id")
    .action(async (databaseId, opts) => {
      await runAction("databases get", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(databaseId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Database id is required", {
            recoverable: true,
            suggestedAction: "Provide <database_id> or --id"
          });
        }
        const response = await request<any>({
          method: "GET",
          path: `/databases/${id}`,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      });
    });

  databases
    .command("create")
    .description("Create database")
    .requiredOption("--parent <json>", "Parent JSON or @file")
    .requiredOption("--title <json>", "Title JSON or @file")
    .requiredOption("--properties <json>", "Properties JSON or @file")
    .option("--icon <json>", "Icon JSON or @file")
    .option("--cover <json>", "Cover JSON or @file")
    .option("--description <json>", "Description JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (opts) => {
      await runAction("databases create", opts, async (ctx) => {
        requireToken(ctx.config);
        const body = {
          parent: await readJsonInput(opts.parent),
          title: await readJsonInput(opts.title),
          properties: await readJsonInput(opts.properties),
          icon: await readJsonInput(opts.icon),
          cover: await readJsonInput(opts.cover),
          description: await readJsonInput(opts.description)
        };
        await validateInput(ctx, schemaPath("databases-create.schema.json"), body);
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "POST",
          path: "/databases",
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.parent, opts.title, opts.properties, opts.icon, opts.cover, opts.description]);
    });

  databases
    .command("update [database_id]")
    .description("Update database")
    .option("--id <id>", "Database id")
    .option("--title <json>", "Title JSON or @file")
    .option("--properties <json>", "Properties JSON or @file")
    .option("--description <json>", "Description JSON or @file")
    .option("--icon <json>", "Icon JSON or @file")
    .option("--cover <json>", "Cover JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (databaseId, opts) => {
      await runAction("databases update", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(databaseId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Database id is required", {
            recoverable: true,
            suggestedAction: "Provide <database_id> or --id"
          });
        }
        const body = {
          title: await readJsonInput(opts.title),
          properties: await readJsonInput(opts.properties),
          description: await readJsonInput(opts.description),
          icon: await readJsonInput(opts.icon),
          cover: await readJsonInput(opts.cover)
        };
        await validateInput(ctx, schemaPath("databases-update.schema.json"), body);
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "PATCH",
          path: `/databases/${id}`,
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.title, opts.properties, opts.description, opts.icon, opts.cover]);
    });
}
