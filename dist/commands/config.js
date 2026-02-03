import { CliError } from "../core/errors.js";
import { loadConfigFile, saveConfigFile } from "../core/config.js";
function ensureProfile(config, name) {
    if (!config.profiles)
        config.profiles = {};
    if (!config.profiles[name])
        config.profiles[name] = {};
}
const PROFILE_FIELDS = [
    "token",
    "notion_version",
    "timeout_ms",
    "retries",
    "pretty"
];
function isProfileField(value) {
    return PROFILE_FIELDS.includes(value);
}
function parseKey(key) {
    if (key === "token")
        return { scope: "profile", profile: "default", field: "token" };
    if (key === "default-profile")
        return { scope: "root", field: "default_profile" };
    if (key.startsWith("profile.")) {
        const parts = key.split(".");
        if (parts.length !== 3 || !parts[1] || !parts[2]) {
            throw new CliError("INVALID_ARGUMENT", "Config key must be profile.<name>.<field>", {
                recoverable: true,
                suggestedAction: "Use profile.<name>.token"
            });
        }
        if (!isProfileField(parts[2])) {
            throw new CliError("INVALID_ARGUMENT", "Unknown profile config field", {
                recoverable: true,
                suggestedAction: "Use token, notion_version, timeout_ms, retries, or pretty",
                context: { field: parts[2] }
            });
        }
        return { scope: "profile", profile: parts[1], field: parts[2] };
    }
    throw new CliError("INVALID_ARGUMENT", "Unknown config key", {
        recoverable: true,
        suggestedAction: "Use token, default-profile, or profile.<name>.<token|notion_version|timeout_ms|retries|pretty>",
        context: { key }
    });
}
export function registerConfig(program, helpers) {
    const { runAction } = helpers;
    const config = program.command("config").description("Manage CLI configuration");
    config
        .command("set <key> <value>")
        .description("Set a configuration value")
        .action(async (key, value, opts) => {
        await runAction("config set", opts, async () => {
            const existing = (await loadConfigFile()) ?? {};
            const parsed = parseKey(key);
            if (parsed.scope === "root") {
                existing[parsed.field] = value;
            }
            else {
                const profileName = parsed.profile ?? existing.default_profile ?? "default";
                ensureProfile(existing, profileName);
                existing.profiles[profileName][parsed.field] = value;
                if (!existing.default_profile)
                    existing.default_profile = profileName;
            }
            await saveConfigFile(existing);
            return { data: { ok: true, path: key } };
        });
    });
    config
        .command("get <key>")
        .description("Get a configuration value")
        .action(async (key, opts) => {
        await runAction("config get", opts, async () => {
            const existing = (await loadConfigFile()) ?? {};
            const parsed = parseKey(key);
            if (parsed.scope === "root") {
                return { data: { value: existing[parsed.field] ?? null } };
            }
            const profileName = parsed.profile ?? existing.default_profile ?? "default";
            const value = existing.profiles?.[profileName]?.[parsed.field] ?? null;
            return { data: { value } };
        });
    });
    config
        .command("unset <key>")
        .description("Remove a configuration value")
        .action(async (key, opts) => {
        await runAction("config unset", opts, async () => {
            const existing = (await loadConfigFile()) ?? {};
            const parsed = parseKey(key);
            if (parsed.scope === "root") {
                delete existing[parsed.field];
            }
            else {
                const profileName = parsed.profile ?? existing.default_profile ?? "default";
                if (existing.profiles?.[profileName]) {
                    delete existing.profiles[profileName][parsed.field];
                }
            }
            await saveConfigFile(existing);
            return { data: { ok: true, path: key } };
        });
    });
}
