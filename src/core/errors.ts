export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "MISSING_ARGUMENT"
  | "RESOURCE_NOT_FOUND"
  | "ALREADY_EXISTS"
  | "PERMISSION_DENIED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "INTERNAL_ERROR"
  | "DEPENDENCY_MISSING"
  | "CONFIG_ERROR"
  | "UNSUPPORTED_OPERATION";

export type ErrorEnvelope = {
  status: "error";
  error: {
    code: ErrorCode;
    message: string;
    recoverable: boolean;
    suggested_action?: string | null;
    context?: Record<string, unknown> | null;
  };
  metadata: Record<string, unknown>;
};

export const EXIT_CODES: Record<ErrorCode | "PARTIAL" | "SUCCESS", number> = {
  SUCCESS: 0,
  PARTIAL: 3,
  INVALID_ARGUMENT: 2,
  MISSING_ARGUMENT: 2,
  RESOURCE_NOT_FOUND: 4,
  ALREADY_EXISTS: 1,
  PERMISSION_DENIED: 11,
  AUTH_FAILED: 10,
  RATE_LIMITED: 12,
  TIMEOUT: 20,
  CONFLICT: 5,
  PRECONDITION_FAILED: 1,
  CONFIRMATION_REQUIRED: 1,
  IDEMPOTENCY_KEY_CONFLICT: 1,
  UNSUPPORTED_SCHEMA_VERSION: 1,
  INTERNAL_ERROR: 125,
  DEPENDENCY_MISSING: 30,
  CONFIG_ERROR: 1,
  UNSUPPORTED_OPERATION: 1
};

export class CliError extends Error {
  code: ErrorCode;
  recoverable: boolean;
  suggestedAction?: string;
  context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      recoverable?: boolean;
      suggestedAction?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
    this.suggestedAction = options?.suggestedAction;
    this.context = options?.context;
  }
}

export function mapHttpStatusToError(status: number): ErrorCode {
  if (status === 400) return "INVALID_ARGUMENT";
  if (status === 401) return "AUTH_FAILED";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 404) return "RESOURCE_NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 412) return "PRECONDITION_FAILED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 408) return "TIMEOUT";
  if (status >= 500) return "INTERNAL_ERROR";
  return "INTERNAL_ERROR";
}
