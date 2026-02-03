# Error Code Registry

Stable error codes in UPPER_SNAKE_CASE. Do not rename once published.

| Code | Recoverable | Meaning |
|---|---|---|
| INVALID_ARGUMENT | Yes | Bad flag value or argument |
| MISSING_ARGUMENT | Yes | Required flag/arg missing |
| RESOURCE_NOT_FOUND | Yes | Target entity doesn't exist |
| ALREADY_EXISTS | Yes | Create target already present |
| PERMISSION_DENIED | No | Auth valid but insufficient |
| AUTH_FAILED | No | Invalid/expired credentials |
| RATE_LIMITED | Yes | Too many requests |
| TIMEOUT | Yes | Operation exceeded time limit |
| CONFLICT | Yes | Concurrent modification |
| PRECONDITION_FAILED | Yes | Required state not met |
| CONFIRMATION_REQUIRED | Yes | Destructive op without --yes |
| IDEMPOTENCY_KEY_CONFLICT | No | Same key, different params |
| UNSUPPORTED_SCHEMA_VERSION | No | Requested schema not supported |
| INTERNAL_ERROR | No | Unexpected tool failure |
| DEPENDENCY_MISSING | No | External tool absent |
| CONFIG_ERROR | No | Bad configuration |
| UNSUPPORTED_OPERATION | No | Command not available |

## Notes
- `recoverable: true` means agent can retry or adjust inputs.
- Always include `suggested_action` when recoverable.
- Always include `context` with relevant structured data.
