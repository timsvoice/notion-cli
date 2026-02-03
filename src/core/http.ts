import { fetch, Headers, RequestInit, FormData } from "undici";
import { BASE_URL } from "./constants.js";
import { CliError, mapHttpStatusToError } from "./errors.js";

export type RequestOptions = {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  token?: string;
  notionVersion: string;
  timeoutMs: number;
  retries: number;
  idempotencyKey?: string;
  contentType?: string;
  extraHeaders?: Record<string, string>;
};

export type HttpResponse<T> = {
  status: number;
  data: T;
  headers: Headers;
};

function encodeQuery(
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function validatePath(pathValue: string): void {
  const lowered = decodeURIComponent(pathValue).toLowerCase();
  if (lowered.includes("..") || lowered.includes("%2e")) {
    throw new CliError("INVALID_ARGUMENT", "Path traversal is not allowed", {
      recoverable: true,
      suggestedAction: "Provide a safe API path",
      context: { path: pathValue }
    });
  }
}

async function doFetch<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<HttpResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : ({} as T);
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new CliError("TIMEOUT", `Request timed out after ${timeoutMs}ms`, {
        recoverable: true,
        suggestedAction: "Retry with a higher --timeout value",
        context: { timeout_ms: timeoutMs }
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T>(options: RequestOptions): Promise<HttpResponse<T>> {
  validatePath(options.path);
  const url = `${BASE_URL}${options.path}${encodeQuery(options.query)}`;

  const headers: Record<string, string> = {
    "Notion-Version": options.notionVersion
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  } else if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
  }

  const init: RequestInit = {
    method: options.method,
    headers
  };

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else {
      init.body = JSON.stringify(options.body);
    }
  }

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= options.retries) {
    attempt += 1;
    try {
      const response = await doFetch<T>(url, init, options.timeoutMs);
      if (response.status >= 200 && response.status < 300) {
        return response;
      }

      const errorData = response.data as any;
      const notionCode = errorData?.code;
      const message = errorData?.message || `Request failed with ${response.status}`;
      const mapped = mapHttpStatusToError(response.status);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 1000;
        if (attempt <= options.retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      throw new CliError(mapped, message, {
        recoverable: response.status === 429 || response.status >= 500,
        suggestedAction:
          response.status === 429
            ? "Retry after the Retry-After interval"
            : undefined,
        context: { status: response.status, notion_code: notionCode }
      });
    } catch (error) {
      lastError = error;
      if (error instanceof CliError) {
        if (error.code === "TIMEOUT" && attempt <= options.retries) {
          continue;
        }
        throw error;
      }
      if (attempt > options.retries) {
        break;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new CliError("INTERNAL_ERROR", "Request failed", { recoverable: false });
}
