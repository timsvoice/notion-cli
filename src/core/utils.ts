import fs from "node:fs/promises";
import path from "node:path";

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonInput(input?: string | null): Promise<unknown> {
  if (!input) return null;
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

export function ensureObject(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function nowIso(): string {
  return new Date().toISOString();
}
