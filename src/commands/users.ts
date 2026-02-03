import { Command } from "commander";
import { request } from "../core/http.js";
import { CliError } from "../core/errors.js";
import { paginateAll } from "../core/pagination.js";
import { CommandHelpers } from "./utils.js";

export function registerUsers(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, parseId } = helpers;

  const users = program.command("users").description("Users endpoints");

  users
    .command("list")
    .description("List users")
    .option("--page-size <n>", "Page size", (value) => Number(value))
    .option("--start-cursor <cursor>", "Start cursor")
    .option("--all", "Auto paginate")
    .action(async (opts) => {
      await runAction("users list", opts, async (ctx) => {
        requireToken(ctx.config);
        if (opts.all) {
          const results = await paginateAll(async (cursor) => {
            const response = await request<any>({
              method: "GET",
              path: "/users",
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
          path: "/users",
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

  users
    .command("get [user_id]")
    .description("Get user")
    .option("--id <id>", "User id")
    .action(async (userId, opts) => {
      await runAction("users get", opts, async (ctx) => {
        requireToken(ctx.config);
        const id = parseId(userId, opts.id);
        if (!id) {
          throw new CliError("MISSING_ARGUMENT", "User id is required", {
            recoverable: true,
            suggestedAction: "Provide <user_id> or --id"
          });
        }
        const response = await request<any>({
          method: "GET",
          path: `/users/${id}`,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      });
    });

  users
    .command("me")
    .description("Get current user")
    .action(async (opts) => {
      await runAction("users me", opts, async (ctx) => {
        requireToken(ctx.config);
        const response = await request<any>({
          method: "GET",
          path: "/users/me",
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      });
    });
}
