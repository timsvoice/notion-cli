import { CLI_VERSION, SCHEMA_VERSION } from "./constants.js";
import { ErrorEnvelope } from "./errors.js";

export type SuccessEnvelope = {
  status: "success";
  data: unknown;
  warnings: string[];
  metadata: Record<string, unknown>;
};

export type PartialEnvelope = {
  status: "partial";
  data: unknown;
  metadata: Record<string, unknown>;
};

export function successEnvelope(
  command: string,
  data: unknown,
  warnings: string[] = [],
  metadata: Record<string, unknown> = {}
): SuccessEnvelope {
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

export function partialEnvelope(
  command: string,
  data: unknown,
  metadata: Record<string, unknown> = {}
): PartialEnvelope {
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

export function errorEnvelope(
  command: string,
  error: ErrorEnvelope["error"],
  metadata: Record<string, unknown> = {}
): ErrorEnvelope {
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

export function writeJson(value: unknown, pretty: boolean): void {
  const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  process.stdout.write(json + "\n");
}

export function writeNdjsonLine(value: unknown): void {
  process.stdout.write(JSON.stringify(value) + "\n");
}
