import fs from "node:fs/promises";
import path from "node:path";
import { FormData } from "undici";
import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { paginateAll } from "../core/pagination.js";
import { DEFAULT_CHUNK_SIZE } from "../core/constants.js";
import { ensureConfigDir } from "../core/config.js";
import { appendOp, createReceipt, touchOp, updateOp } from "../ops/registry.js";
export function registerFileUploads(program, helpers) {
    const { runAction, requireToken, parseId, validateInput, schemaPath } = helpers;
    const fileUploads = program.command("file-uploads").description("File uploads");
    fileUploads
        .command("create")
        .description("Create file upload")
        .requiredOption("--file-name <name>", "File name")
        .requiredOption("--content-type <type>", "Content type")
        .requiredOption("--size <bytes>", "File size", (value) => Number(value))
        .option("--dry-run", "Dry run")
        .option("--idempotency-key <key>", "Idempotency key")
        .action(async (opts) => {
        await runAction("file-uploads create", opts, async (ctx) => {
            requireToken(ctx.config);
            const body = {
                file_name: opts.fileName,
                content_type: opts.contentType,
                size: opts.size
            };
            await validateInput(ctx, schemaPath("file-uploads-create.schema.json"), body);
            if (opts.dryRun) {
                return { data: { dry_run: true, request: body }, exitCode: 40 };
            }
            const response = await request({
                method: "POST",
                path: "/file_uploads",
                body,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                idempotencyKey: opts.idempotencyKey
            });
            return { data: response.data };
        });
    });
    fileUploads
        .command("send [file_upload_id]")
        .description("Send file upload")
        .option("--id <id>", "File upload id")
        .requiredOption("--file <path>", "File path")
        .option("--chunk-size <bytes>", "Chunk size", (value) => Number(value), DEFAULT_CHUNK_SIZE)
        .option("--dry-run", "Dry run")
        .option("--async", "Create op receipt and pollable metadata")
        .action(async (fileUploadId, opts) => {
        await runAction("file-uploads send", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(fileUploadId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "File upload id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <file_upload_id> or --id"
                });
            }
            if (opts.dryRun) {
                return { data: { dry_run: true, request: { file: opts.file } }, exitCode: 40 };
            }
            const op = createReceipt({
                type: "file_upload_send",
                status: "IN_PROGRESS",
                resource_id: id,
                resource_type: "file_upload",
                poll: {
                    method: "GET",
                    path: `/file_uploads/${id}`
                }
            });
            if (opts.async) {
                await ensureConfigDir();
                await appendOp(op);
            }
            const form = new FormData();
            const fileBuffer = await fs.readFile(opts.file);
            form.append("file", new Blob([fileBuffer]), path.basename(opts.file));
            const response = await request({
                method: "POST",
                path: `/file_uploads/${id}/send`,
                body: form,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                contentType: undefined
            });
            if (opts.async) {
                const updated = touchOp(op, { status: "COMPLETED", metadata: { response: response.data } });
                await updateOp(updated);
                return { data: updated };
            }
            return { data: response.data };
        });
    });
    fileUploads
        .command("complete [file_upload_id]")
        .description("Complete file upload")
        .option("--id <id>", "File upload id")
        .option("--dry-run", "Dry run")
        .action(async (fileUploadId, opts) => {
        await runAction("file-uploads complete", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(fileUploadId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "File upload id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <file_upload_id> or --id"
                });
            }
            const body = {};
            await validateInput(ctx, schemaPath("file-uploads-complete.schema.json"), body);
            if (opts.dryRun) {
                return { data: { dry_run: true }, exitCode: 40 };
            }
            const response = await request({
                method: "POST",
                path: `/file_uploads/${id}/complete`,
                body,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries
            });
            return { data: response.data };
        });
    });
    fileUploads
        .command("get [file_upload_id]")
        .description("Get file upload")
        .option("--id <id>", "File upload id")
        .action(async (fileUploadId, opts) => {
        await runAction("file-uploads get", opts, async (ctx) => {
            requireToken(ctx.config);
            const id = parseId(fileUploadId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "File upload id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <file_upload_id> or --id"
                });
            }
            const response = await request({
                method: "GET",
                path: `/file_uploads/${id}`,
                token: ctx.config.token,
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries
            });
            return { data: response.data };
        });
    });
    fileUploads
        .command("list")
        .description("List file uploads")
        .option("--status <status>", "Status")
        .option("--page-size <n>", "Page size", (value) => Number(value))
        .option("--start-cursor <cursor>", "Start cursor")
        .option("--all", "Auto paginate")
        .action(async (opts) => {
        await runAction("file-uploads list", opts, async (ctx) => {
            requireToken(ctx.config);
            if (opts.all) {
                const results = await paginateAll(async (cursor) => {
                    const response = await request({
                        method: "GET",
                        path: "/file_uploads",
                        query: {
                            status: opts.status,
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
                path: "/file_uploads",
                query: {
                    status: opts.status,
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
