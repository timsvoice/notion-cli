import { Context, GlobalOptions } from "../core/cli.js";

export type CommandHelpers = {
  runAction: <T>(
    command: string,
    options: GlobalOptions,
    handler: (ctx: Context) => Promise<{ data: T; exitCode?: number }>,
    stdinInputs?: Array<string | undefined>
  ) => Promise<void>;
  requireToken: (config: Context["config"]) => string;
  parseId: (positional: string | undefined, flagValue?: string) => string;
  validateInput: (ctx: Context, schema: string, data: unknown) => Promise<void>;
  schemaPath: (name: string) => string;
  readJsonInput: (input?: string | null) => Promise<unknown>;
};
