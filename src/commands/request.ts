import { Command } from "commander";
import { request } from "../core/http.js";
import { CommandHelpers } from "./utils.js";

export function registerRequest(program: Command, helpers: CommandHelpers): void {
  const { runAction, requireToken, readJsonInput } = helpers;

  program
    .command("request")
    .description("Pass-through request")
    .requiredOption("--method <method>", "HTTP method")
    .requiredOption("--path <path>", "Request path")
    .option("--query <json>", "Query JSON or @file")
    .option("--body <json>", "Body JSON or @file")
    .action(async (opts) => {
      await runAction("request", opts, async (ctx) => {
        requireToken(ctx.config);
        const query = (await readJsonInput(opts.query)) as Record<string, any> | null;
        const body = await readJsonInput(opts.body);
        const response = await request<any>({
          method: opts.method,
          path: opts.path,
          query: query ?? undefined,
          body,
          token: ctx.config.token,
          notionVersion: ctx.config.notionVersion,
          timeoutMs: ctx.config.timeoutMs,
          retries: ctx.config.retries
        });
        return { data: response.data };
      }, [opts.query, opts.body]);
    });
}
