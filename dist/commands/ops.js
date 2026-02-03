import { CliError } from "../core/errors.js";
import { request } from "../core/http.js";
import { readOps, touchOp, updateOp } from "../ops/registry.js";
export function registerOps(program, helpers) {
    const { runAction, parseId } = helpers;
    const ops = program.command("ops").description("Async ops registry");
    ops
        .command("get [op_id]")
        .description("Get op receipt")
        .option("--id <id>", "Op id")
        .action(async (opId, opts) => {
        await runAction("ops get", opts, async () => {
            const id = parseId(opId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Op id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <op_id> or --id"
                });
            }
            const opsList = await readOps();
            const found = opsList.find((item) => item.op_id === id);
            if (!found) {
                throw new CliError("RESOURCE_NOT_FOUND", "Op not found", {
                    recoverable: true,
                    suggestedAction: "Verify the op id",
                    context: { op_id: id }
                });
            }
            return { data: found };
        });
    });
    ops
        .command("wait [op_id]")
        .description("Wait for op completion")
        .option("--id <id>", "Op id")
        .option("--timeout <sec>", "Timeout seconds", (value) => Number(value), 60)
        .action(async (opId, opts) => {
        await runAction("ops wait", opts, async (ctx) => {
            const id = parseId(opId, opts.id);
            if (!id) {
                throw new CliError("MISSING_ARGUMENT", "Op id is required", {
                    recoverable: true,
                    suggestedAction: "Provide <op_id> or --id"
                });
            }
            const deadline = Date.now() + opts.timeout * 1000;
            while (Date.now() < deadline) {
                const opsList = await readOps();
                const found = opsList.find((item) => item.op_id === id);
                if (!found) {
                    throw new CliError("RESOURCE_NOT_FOUND", "Op not found", {
                        recoverable: true,
                        suggestedAction: "Verify the op id",
                        context: { op_id: id }
                    });
                }
                if (found.status === "COMPLETED" || found.status === "FAILED") {
                    return { data: found };
                }
                if (found.poll) {
                    try {
                        const response = await request({
                            method: found.poll.method,
                            path: found.poll.path,
                            token: ctx.config.token,
                            notionVersion: ctx.config.notionVersion,
                            timeoutMs: ctx.config.timeoutMs,
                            retries: ctx.config.retries
                        });
                        const updated = touchOp(found, { metadata: { poll: response.data } });
                        await updateOp(updated);
                    }
                    catch (error) {
                        const failed = touchOp(found, {
                            status: "FAILED",
                            error: {
                                code: "POLL_FAILED",
                                message: error instanceof Error ? error.message : "Poll failed"
                            }
                        });
                        await updateOp(failed);
                        return { data: failed };
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            throw new CliError("TIMEOUT", "Op wait timed out", {
                recoverable: true,
                suggestedAction: "Increase --timeout",
                context: { op_id: id }
            });
        });
    });
}
