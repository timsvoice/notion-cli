import fs from "node:fs/promises";
import path from "node:path";
export async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}
export async function readJsonInput(input) {
    if (!input)
        return null;
    if (input === "-") {
        const raw = await readStdin();
        return raw.trim() ? JSON.parse(raw) : null;
    }
    if (input.startsWith("@")) {
        const filePath = input.slice(1);
        const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(process.cwd(), filePath);
        const raw = await fs.readFile(absPath, "utf8");
        return raw.trim() ? JSON.parse(raw) : null;
    }
    return JSON.parse(input);
}
export function ensureObject(value, name) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${name} must be a JSON object`);
    }
    return value;
}
export function toArray(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
export function nowIso() {
    return new Date().toISOString();
}
