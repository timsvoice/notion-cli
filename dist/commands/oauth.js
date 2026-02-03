import { request } from "../core/http.js";
export function registerOauth(program, helpers) {
    const { runAction, validateInput, schemaPath } = helpers;
    const oauth = program.command("oauth").description("OAuth endpoints");
    oauth
        .command("token")
        .description("Request OAuth token")
        .requiredOption("--grant-type <type>", "Grant type")
        .option("--code <code>", "Authorization code")
        .option("--redirect-uri <uri>", "Redirect URI")
        .option("--refresh-token <token>", "Refresh token")
        .option("--external-account <id>", "External account id")
        .option("--client-id <id>", "OAuth client id")
        .option("--client-secret <secret>", "OAuth client secret")
        .action(async (opts) => {
        await runAction("oauth token", opts, async (ctx) => {
            const body = {
                grant_type: opts.grantType,
                code: opts.code,
                redirect_uri: opts.redirectUri,
                refresh_token: opts.refreshToken,
                external_account: opts.externalAccount
            };
            await validateInput(ctx, schemaPath("oauth-token.schema.json"), body);
            const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64");
            const response = await request({
                method: "POST",
                path: "/oauth/token",
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                body,
                extraHeaders: {
                    Authorization: `Basic ${basic}`
                }
            });
            return { data: response.data };
        });
    });
    oauth
        .command("introspect")
        .description("Introspect OAuth token")
        .requiredOption("--token <token>", "Token to introspect")
        .action(async (opts) => {
        await runAction("oauth introspect", opts, async (ctx) => {
            const body = { token: opts.token };
            await validateInput(ctx, schemaPath("oauth-introspect.schema.json"), body);
            const response = await request({
                method: "POST",
                path: "/oauth/introspect",
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                body
            });
            return { data: response.data };
        });
    });
    oauth
        .command("revoke")
        .description("Revoke OAuth token")
        .requiredOption("--token <token>", "Token to revoke")
        .action(async (opts) => {
        await runAction("oauth revoke", opts, async (ctx) => {
            const body = { token: opts.token };
            await validateInput(ctx, schemaPath("oauth-revoke.schema.json"), body);
            const response = await request({
                method: "POST",
                path: "/oauth/revoke",
                notionVersion: ctx.config.notionVersion,
                timeoutMs: ctx.config.timeoutMs,
                retries: ctx.config.retries,
                body
            });
            return { data: response.data };
        });
    });
}
