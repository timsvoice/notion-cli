# Output Envelope Schema

All commands must write a JSON envelope to stdout. This envelope is the only machine-readable output channel.

## Success
```json
{
  "status": "success",
  "data": {},
  "warnings": [],
  "metadata": {
    "command": "pages get",
    "duration_ms": 42,
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

## Error
```json
{
  "status": "error",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Page not found",
    "recoverable": true,
    "suggested_action": "Verify the page id",
    "context": {
      "page_id": "..."
    }
  },
  "metadata": {
    "command": "pages get",
    "duration_ms": 12,
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

## Partial
```json
{
  "status": "partial",
  "data": {
    "succeeded": [],
    "failed": []
  },
  "metadata": {
    "command": "bulk delete",
    "total": 0,
    "succeeded_count": 0,
    "failed_count": 0,
    "duration_ms": 0,
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

## Rules
- Always emit an envelope object (never a bare array/string)
- `status` is required and must be one of: success, error, partial
- `metadata.schema_version` must increment when output changes
- Timestamps are ISO 8601 with timezone
- Enum values are UPPER_SNAKE_CASE
- stdout is JSON only; stderr is for logs and human-readable errors
