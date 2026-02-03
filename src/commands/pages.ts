import { Command } from "commander";
import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { CommandHelpers } from "./utils.js";

export function registerPages(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, parseId, readJsonInput, validateInput, schemaPath } = helpers;

  const pages = program.command("pages").description("Pages endpoints");

  pages
    .command("create")
    .description("Create page")
    .requiredOption("--parent <json>", "Parent JSON or @file")
    .requiredOption("--properties <json>", "Properties JSON or @file")
    .option("--children <json>", "Children JSON or @file")
    .option("--icon <json>", "Icon JSON or @file")
    .option("--cover <json>", "Cover JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (opts, command) => {
      await runAction("pages create", opts, async (ctx) => {
        requireToken(ctx.config);
        const body = {
          parent: await readJsonInput(opts.parent),
          properties: await readJsonInput(opts.properties),
          children: await readJsonInput(opts.children),
          icon: await readJsonInput(opts.icon),
          cover: await readJsonInput(opts.cover)
        };
        await validateInput(ctx, schemaPath("pages-create.schema.json"), body);

        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }

        const response = await request<any>({
          method: "POST",
          path: "/pages",
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.parent, opts.properties, opts.children, opts.icon, opts.cover], command);
    });

  pages
    .command("get [page_id]")
    .description("Get page")
    .option("--id <id>", "Page id")
    .action(async (pageId, opts, command) => {
      await runAction("pages get", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(pageId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Page id is required", {
            recoverable: true,
            suggestedAction: "Provide <page_id> or --id"
          });
        }
        const response = await request<any>({
          method: "GET",
          path: `/pages/${id}`,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      }, [], command);
    });

  pages
    .command("update [page_id]")
    .description("Update page")
    .option("--id <id>", "Page id")
    .option("--properties <json>", "Properties JSON or @file")
    .option("--archived <bool>", "Archived", (value) => value === "true")
    .option("--in-trash <bool>", "In trash", (value) => value === "true")
    .option("--icon <json>", "Icon JSON or @file")
    .option("--cover <json>", "Cover JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (pageId, opts, command) => {
      await runAction("pages update", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(pageId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Page id is required", {
            recoverable: true,
            suggestedAction: "Provide <page_id> or --id"
          });
        }
        const body = {
          properties: await readJsonInput(opts.properties),
          archived: opts.archived,
          in_trash: opts.inTrash,
          icon: await readJsonInput(opts.icon),
          cover: await readJsonInput(opts.cover)
        };
        await validateInput(ctx, schemaPath("pages-update.schema.json"), body);
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "PATCH",
          path: `/pages/${id}`,
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.properties, opts.icon, opts.cover], command);
    });

  pages
    .command("move [page_id]")
    .description("Move page")
    .option("--id <id>", "Page id")
    .requiredOption("--parent <json>", "Parent JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (pageId, opts, command) => {
      await runAction("pages move", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(pageId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Page id is required", {
            recoverable: true,
            suggestedAction: "Provide <page_id> or --id"
          });
        }
        const body = {
          parent: await readJsonInput(opts.parent)
        };
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "POST",
          path: `/pages/${id}/move`,
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.parent], command);
    });

  pages
    .command("get-property [page_id] [property_id]")
    .description("Get page property")
    .option("--id <id>", "Page id")
    .option("--property-id <id>", "Property id")
    .action(async (pageId, propertyId, opts, command) => {
      await runAction("pages get-property", opts, async (ctx) => {
        requireToken(ctx.config);
        const pid = parseId(pageId, opts.id);
        const prop = parseId(propertyId, opts.propertyId);
        if (!pid || !prop) {
          throw new CliError("MISSING_ARGUMENT", "Page id and property id are required", {
            recoverable: true,
            suggestedAction: "Provide <page_id> <property_id> or --id and --property-id"
          });
        }
        const response = await request<any>({
          method: "GET",
          path: `/pages/${pid}/properties/${prop}`,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      }, [], command);
    });
}
