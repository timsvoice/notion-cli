import fs from "node:fs/promises";
import path from "node:path";
import { OPS_PATH, RETENTION_DAYS } from "../core/constants.js";
import { nowIso } from "../core/utils.js";
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
export async function readOps() {
    try {
        const raw = await fs.readFile(OPS_PATH, "utf8");
        if (!raw.trim())
            return [];
        return raw
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
    }
    catch (error) {
        const err = error;
        if (err.code === "ENOENT")
            return [];
        throw error;
    }
}
export async function writeOps(ops) {
    const content = ops.map((op) => JSON.stringify(op)).join("\n");
    await fs.mkdir(path.dirname(OPS_PATH), { recursive: true });
    await fs.writeFile(OPS_PATH, content + (content ? "\n" : ""), "utf8");
}
export async function appendOp(op) {
    const ops = await readOps();
    const cleaned = cleanupOps(ops);
    cleaned.push(op);
    await writeOps(cleaned);
}
export async function updateOp(op) {
    const ops = await readOps();
    const cleaned = cleanupOps(ops).map((existing) => existing.op_id === op.op_id ? op : existing);
    await writeOps(cleaned);
}
export function createReceipt(input) {
    const now = nowIso();
    return {
        op_id: input.op_id ?? crypto.randomUUID(),
        type: input.type ?? "operation",
        status: input.status ?? "PENDING",
        resource_id: input.resource_id ?? null,
        resource_type: input.resource_type ?? null,
        created_at: input.created_at ?? now,
        updated_at: input.updated_at ?? now,
        metadata: input.metadata ?? {},
        poll: input.poll ?? null,
        error: input.error ?? null
    };
}
export function touchOp(op, patch) {
    return {
        ...op,
        ...patch,
        updated_at: nowIso()
    };
}
function cleanupOps(ops) {
    const cutoff = Date.now() - RETENTION_DAYS * MILLIS_PER_DAY;
    return ops.filter((op) => new Date(op.updated_at).getTime() >= cutoff);
}
