import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { paginateAll } from "../core/pagination.js";
export function registerBlocks(program, helpers) {
    const { runAction, requireToken, parseId, readJsonInput, validateInput, schemaPath } = helpers;
    const blocks = program.command("blocks").description("Blocks endpoints");
    blocks
        .command("get [block_id]")
        .description("Get block")
        .option("--id <id>", "Block id")
        .action(async (blockId, opts) => {
        await runAction("blocks get", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(blockId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Block id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <block_id> or --id"
                });
            }
            const response = await request({
                method: "GET",
                path: `/blocks/${id}`,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries
            });
            return { data: response.data };
        });
    });
    blocks
        .command("update [block_id]")
        .description("Update block")
        .option("--id <id>", "Block id")
        .requiredOption("--data <json>", "Block data JSON or @file")
        .option("--dry-run", "Dry run")
        .option("--idempotency-key <key>", "Idempotency key")
        .action(async (blockId, opts) => {
        await runAction("blocks update", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(blockId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Block id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <block_id> or --id"
                });
            }
            const body = await readJsonInput(opts.data);
            await validateInput(ctx, schemaPath("blocks-update.schema.json"), body);
            if (opts.dryRun) {
                return { data: { dry_run: true, request: body }, exitCode: 40 };
            }
            const response = await request({
                method: "PATCH",
                path: `/blocks/${id}`,
                body,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                idempotencyKey: opts.idempotencyKey
            });
            return { data: response.data };
        }, [opts.data]);
    });
    blocks
        .command("delete [block_id]")
        .description("Delete block")
        .option("--id <id>", "Block id")
        .option("--dry-run", "Dry run")
        .action(async (blockId, opts) => {
        await runAction("blocks delete", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(blockId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Block id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <block_id> or --id"
                });
            }
            if (opts.dryRun) {
                return { data: { dry_run: true }, exitCode: 40 };
            }
            const response = await request({
                method: "DELETE",
                path: `/blocks/${id}`,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries
            });
            return { data: response.data };
        });
    });
    blocks
        .command("list-children [block_id]")
        .description("List block children")
        .option("--id <id>", "Block id")
        .option("--page-size <n>", "Page size", (value) => Number(value))
        .option("--start-cursor <cursor>", "Start cursor")
        .option("--all", "Auto paginate")
        .action(async (blockId, opts) => {
        await runAction("blocks list-children", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(blockId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Block id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <block_id> or --id"
                });
            }
            if (opts.all) {
                const results = await paginateAll(async (cursor) => {
                    const response = await request({
                        method: "GET",
                        path: `/blocks/${id}/children`,
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
            const response = await request({
                method: "GET",
                path: `/blocks/${id}/children`,
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
    blocks
        .command("append-children [block_id]")
        .description("Append block children")
        .option("--id <id>", "Block id")
        .requiredOption("--children <json>", "Children JSON or @file")
        .option("--dry-run", "Dry run")
        .option("--idempotency-key <key>", "Idempotency key")
        .action(async (blockId, opts) => {
        await runAction("blocks append-children", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(blockId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Block id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <block_id> or --id"
                });
            }
            const body = { children: await readJsonInput(opts.children) };
            await validateInput(ctx, schemaPath("blocks-append.schema.json"), body);
            if (opts.dryRun) {
                return { data: { dry_run: true, request: body }, exitCode: 40 };
            }
            const response = await request({
                method: "PATCH",
                path: `/blocks/${id}/children`,
                body,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                idempotencyKey: opts.idempotencyKey
            });
            return { data: response.data };
        }, [opts.children]);
    });
}
