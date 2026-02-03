import { Command } from "commander";
import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { paginateAll } from "../core/pagination.js";
import { CommandHelpers } from "./utils.js";

export function registerDataSources(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, parseId, readJsonInput, validateInput, schemaPath } = helpers;

  const dataSources = program.command("data-sources").description("Data sources endpoints");

  dataSources
    .command("get [data_source_id]")
    .description("Get data source")
    .option("--id <id>", "Data source id")
    .action(async (dataSourceId, opts) => {
      await runAction("data-sources get", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(dataSourceId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Data source id is required", {
            recoverable: true,
            suggestedAction: "Provide <data_source_id> or --id"
          });
        }
        const response = await request<any>({
          method: "GET",
          path: `/data_sources/${id}`,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      });
    });

  dataSources
    .command("query [data_source_id]")
    .description("Query data source")
    .option("--id <id>", "Data source id")
    .option("--filter <json>", "Filter JSON or @file")
    .option("--sorts <json>", "Sorts JSON or @file")
    .option("--page-size <n>", "Page size", (value) => Number(value))
    .option("--start-cursor <cursor>", "Start cursor")
    .option("--all", "Auto paginate")
    .action(async (dataSourceId, opts) => {
      await runAction("data-sources query", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(dataSourceId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Data source id is required", {
            recoverable: true,
            suggestedAction: "Provide <data_source_id> or --id"
          });
        }
        const body = {
          filter: await readJsonInput(opts.filter),
          sorts: await readJsonInput(opts.sorts),
          page_size: opts.pageSize,
          start_cursor: opts.startCursor
        };
        await validateInput(ctx, schemaPath("data-sources-query.schema.json"), body);
        if (opts.all) {
          const results = await paginateAll(async (cursor) => {
            const response = await request<any>({
              method: "POST",
              path: `/data_sources/${id}/query`,
              body: { ...body, start_cursor: cursor ?? opts.startCursor },
              token: ctx.config.token,
              notionVersion: ctx.config.notionVersion,
              timeoutMs: ctx.config.timeoutMs,
              retries: ctx.config.retries
            });
            return response.data;
          }, { ndjson: ctx.ndjson });
          return { data: results ?? { streamed: true } };
        }
        const response = await request<any>({
          method: "POST",
          path: `/data_sources/${id}/query`,
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      }, [opts.filter, opts.sorts]);
    });

  dataSources
    .command("create")
    .description("Create data source")
    .requiredOption("--parent <json>", "Parent JSON or @file")
    .requiredOption("--title <json>", "Title JSON or @file")
    .requiredOption("--properties <json>", "Properties JSON or @file")
    .option("--icon <json>", "Icon JSON or @file")
    .option("--cover <json>", "Cover JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (opts) => {
      await runAction("data-sources create", opts, async (ctx) => {
        requireToken(ctx.config);
        const body = {
          parent: await readJsonInput(opts.parent),
          title: await readJsonInput(opts.title),
          properties: await readJsonInput(opts.properties),
          icon: await readJsonInput(opts.icon),
          cover: await readJsonInput(opts.cover)
        };
        await validateInput(ctx, schemaPath("data-sources-create.schema.json"), body);
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "POST",
          path: "/data_sources",
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.parent, opts.title, opts.properties, opts.icon, opts.cover]);
    });

  dataSources
    .command("update [data_source_id]")
    .description("Update data source")
    .option("--id <id>", "Data source id")
    .option("--title <json>", "Title JSON or @file")
    .option("--properties <json>", "Properties JSON or @file")
    .option("--description <json>", "Description JSON or @file")
    .option("--icon <json>", "Icon JSON or @file")
    .option("--cover <json>", "Cover JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (dataSourceId, opts) => {
      await runAction("data-sources update", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(dataSourceId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Data source id is required", {
            recoverable: true,
            suggestedAction: "Provide <data_source_id> or --id"
          });
        }
        const body = {
          title: await readJsonInput(opts.title),
          properties: await readJsonInput(opts.properties),
          description: await readJsonInput(opts.description),
          icon: await readJsonInput(opts.icon),
          cover: await readJsonInput(opts.cover)
        };
        await validateInput(ctx, schemaPath("data-sources-update.schema.json"), body);
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "PATCH",
          path: `/data_sources/${id}`,
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

  dataSources
    .command("list-templates [data_source_id]")
    .description("List data source templates")
    .option("--id <id>", "Data source id")
    .option("--page-size <n>", "Page size", (value) => Number(value))
    .option("--start-cursor <cursor>", "Start cursor")
    .option("--all", "Auto paginate")
    .action(async (dataSourceId, opts) => {
      await runAction("data-sources list-templates", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(dataSourceId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Data source id is required", {
            recoverable: true,
            suggestedAction: "Provide <data_source_id> or --id"
          });
        }
        if (opts.all) {
          const results = await paginateAll(async (cursor) => {
            const response = await request<any>({
              method: "GET",
              path: `/data_sources/${id}/templates`,
              query: {
                page_size: opts.pageSize,
                start_cursor: cursor ?? opts.startCursor
              },
              token: ctx.config.token,
              notionVersion: ctx.config.notionVersion,
              timeoutMs: ctx.config.timeoutMs,
              retries: ctx.config.retries
            });
            return response.data;
          }, { ndjson: ctx.ndjson });
          return { data: results ?? { streamed: true } };
        }
        const response = await request<any>({
          method: "GET",
          path: `/data_sources/${id}/templates`,
          query: {
            page_size: opts.pageSize,
            start_cursor: opts.startCursor
          },
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      });
    });
}
