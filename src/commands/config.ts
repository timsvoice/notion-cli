import { Command } from "commander";
import { CliError } from "../core/errors.js";
import { CommandHelpers } from "./utils.js";
import { ConfigFile, ProfileConfig, loadConfigFile, saveConfigFile } from "../core/config.js";

function ensureProfile(config: ConfigFile, name: string): void {
  if (!config.profiles) config.profiles = {};
  if (!config.profiles[name]) config.profiles[name] = {};
}

type ProfileField = keyof ProfileConfig;

type ParsedKey =
  | { scope: "root"; field: "default_profile" }
  | { scope: "profile"; profile?: string; field: ProfileField };

const PROFILE_FIELDS: ProfileField[] = [
  "token",
  "notion_version",
  "timeout_ms",
  "retries",
  "pretty"
];

function isProfileField(value: string): value is ProfileField {
  return PROFILE_FIELDS.includes(value as ProfileField);
}

function parseKey(key: string): ParsedKey {
  if (key === "token") return { scope: "profile", profile: "default", field: "token" };
  if (key === "default-profile") return { scope: "root", field: "default_profile" };
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
    suggestedAction:
      "Use token, default-profile, or profile.<name>.<token|notion_version|timeout_ms|retries|pretty>",
    context: { key }
  });
}

export function registerConfig(program: Command, helpers: CommandHelpers): void {
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
          (existing as any)[parsed.field] = value;
        } else {
          const profileName = parsed.profile ?? existing.default_profile ?? "default";
          ensureProfile(existing, profileName);
          (existing.profiles as Record<string, ProfileConfig>)[profileName][parsed.field] = value;
          if (!existing.default_profile) existing.default_profile = profileName;
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
          return { data: { value: (existing as any)[parsed.field] ?? null } };
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
          delete (existing as any)[parsed.field];
        } else {
          const profileName = parsed.profile ?? existing.default_profile ?? "default";
          if (existing.profiles?.[profileName]) {
            delete (existing.profiles as Record<string, ProfileConfig>)[profileName][parsed.field];
          }
        }

        await saveConfigFile(existing);
        return { data: { ok: true, path: key } };
      });
    });
}
