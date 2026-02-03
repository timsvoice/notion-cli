import { CLI_VERSION, SCHEMA_VERSION } from "./constants.js";
export function successEnvelope(command, data, warnings = [], metadata = {}) {
    return {
        status: "success",
        data,
        warnings,
        metadata: {
            command,
            duration_ms: metadata.duration_ms ?? 0,
            version: CLI_VERSION,
            schema_version: SCHEMA_VERSION,
            ...metadata
        }
    };
}
export function partialEnvelope(command, data, metadata = {}) {
    return {
        status: "partial",
        data,
        metadata: {
            command,
            duration_ms: metadata.duration_ms ?? 0,
            version: CLI_VERSION,
            schema_version: SCHEMA_VERSION,
            ...metadata
        }
    };
}
export function errorEnvelope(command, error, metadata = {}) {
    return {
        status: "error",
        error: {
            ...error,
            suggested_action: error.suggested_action ?? null,
            context: error.context ?? null
        },
        metadata: {
            command,
            duration_ms: metadata.duration_ms ?? 0,
            version: CLI_VERSION,
            schema_version: SCHEMA_VERSION,
            ...metadata
        }
    };
}
export function writeJson(value, pretty) {
    const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    process.stdout.write(json + "\n");
}
export function writeNdjsonLine(value) {
    process.stdout.write(JSON.stringify(value) + "\n");
}
