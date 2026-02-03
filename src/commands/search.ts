import { Command } from "commander";
import { request } from "../core/http.js";
import { paginateAll } from "../core/pagination.js";
import { CommandHelpers } from "./utils.js";

export function registerSearch(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, readJsonInput, validateInput, schemaPath } = helpers;

  program
    .command("search")
    .description("Search Notion")
    .option("--query <query>", "Search query")
    .option("--filter <json>", "Filter JSON or @file")
    .option("--sort <json>", "Sort JSON or @file")
    .option("--page-size <n>", "Page size", (value) => Number(value))
    .option("--start-cursor <cursor>", "Start cursor")
    .option("--all", "Auto paginate")
    .action(async (opts) => {
      await runAction("search", opts, async (ctx) => {
        requireToken(ctx.config);
        const filter = await readJsonInput(opts.filter);
        const sort = await readJsonInput(opts.sort);
        const body = {
          query: opts.query,
          filter,
          sort,
          page_size: opts.pageSize,
          start_cursor: opts.startCursor
        };
        await validateInput(ctx, schemaPath("search.schema.json"), body);

        if (opts.all) {
          const results = await paginateAll(async (cursor) => {
            const response = await request<any>({
              method: "POST",
              path: "/search",
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
          path: "/search",
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      }, [opts.filter, opts.sort]);
    });
}
