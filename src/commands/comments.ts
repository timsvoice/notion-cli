import { Command } from "commander";
import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { paginateAll } from "../core/pagination.js";
import { CommandHelpers } from "./utils.js";

export function registerComments(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, parseId, readJsonInput, validateInput, schemaPath } = helpers;

  const comments = program.command("comments").description("Comments endpoints");

  comments
    .command("create")
    .description("Create comment")
    .option("--parent <json>", "Parent JSON or @file")
    .option("--discussion-id <id>", "Discussion id")
    .requiredOption("--rich-text <json>", "Rich text JSON or @file")
    .option("--dry-run", "Dry run")
    .option("--idempotency-key <key>", "Idempotency key")
    .action(async (opts) => {
      await runAction("comments create", opts, async (ctx) => {
        requireToken(ctx.config);
        const body = {
          parent: await readJsonInput(opts.parent),
          discussion_id: opts.discussionId,
          rich_text: await readJsonInput(opts.richText)
        };
        await validateInput(ctx, schemaPath("comments-create.schema.json"), body);
        if (opts.dryRun) {
          return { data: { dry_run: true, request: body }, exitCode: 40 };
        }
        const response = await request<any>({
          method: "POST",
          path: "/comments",
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries,
          idempotencyKey: opts.idempotencyKey
        });
        return { data: response.data };
      }, [opts.parent, opts.richText]);
    });

  comments
    .command("list")
    .description("List comments")
    .option("--block-id <id>", "Block id")
    .option("--page-size <n>", "Page size", (value) => Number(value))
    .option("--start-cursor <cursor>", "Start cursor")
    .option("--all", "Auto paginate")
    .action(async (opts) => {
      await runAction("comments list", opts, async (ctx) => {
        requireToken(ctx.config);
        if (opts.all) {
          const results = await paginateAll(async (cursor) => {
            const response = await request<any>({
              method: "GET",
              path: "/comments",
              query: {
                block_id: opts.blockId,
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
          path: "/comments",
          query: {
            block_id: opts.blockId,
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

  comments
    .command("get [comment_id]")
    .description("Get comment")
    .option("--id <id>", "Comment id")
    .action(async (commentId, opts) => {
      await runAction("comments get", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(commentId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "Comment id is required", {
            recoverable: true,
            suggestedAction: "Provide <comment_id> or --id"
          });
        }
        const response = await request<any>({
          method: "GET",
          path: `/comments/${id}`,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      });
    });
}
