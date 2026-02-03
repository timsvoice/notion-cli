import fs from "node:fs/promises";
import { CONFIG_DIR, CONFIG_PATH, DEFAULT_NOTION_VERSION, DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS } from "./constants.js";
export async function loadConfigFile() {
    try {
        const stat = await fs.stat(CONFIG_PATH);
        if ((stat.mode & 0o077) !== 0) {
            process.stderr.write("WARN: Config file permissions are too open. Run: chmod 600 ~/.config/notion-cli/config.json\n");
        }
        const raw = await fs.readFile(CONFIG_PATH, "utf8");
        return raw.trim() ? JSON.parse(raw) : null;
    }
    catch (error) {
        const err = error;
        if (err.code === "ENOENT")
            return null;
        throw error;
    }
}
export async function ensureConfigDir() {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
}
export async function saveConfigFile(config) {
    await ensureConfigDir();
    const body = JSON.stringify(config, null, 2);
    await fs.writeFile(CONFIG_PATH, `${body}\n`, "utf8");
    await fs.chmod(CONFIG_PATH, 0o600);
}
export async function resolveConfig(options) {
    const fileConfig = await loadConfigFile();
    const profileName = options.profile ?? fileConfig?.default_profile;
    const profile = profileName ? fileConfig?.profiles?.[profileName] : undefined;
    const token = options.token ??
        options.stdinToken ??
        process.env.NOTION_TOKEN ??
        profile?.token;
    const notionVersion = options.notionVersion ??
        process.env.NOTION_VERSION ??
        profile?.notion_version ??
        DEFAULT_NOTION_VERSION;
    const timeoutMs = options.timeoutMs ??
        (process.env.NOTION_TIMEOUT ? Number(process.env.NOTION_TIMEOUT) : undefined) ??
        profile?.timeout_ms ??
        DEFAULT_TIMEOUT_MS;
    const retries = options.retries ??
        (process.env.NOTION_RETRIES ? Number(process.env.NOTION_RETRIES) : undefined) ??
        profile?.retries ??
        DEFAULT_RETRIES;
    const pretty = options.pretty ??
        (process.env.NOTION_PRETTY ? process.env.NOTION_PRETTY === "1" : undefined) ??
        profile?.pretty ??
        false;
    return {
        token,
        notionVersion,
        timeoutMs,
        retries,
        pretty,
        profile: profileName
    };
}
