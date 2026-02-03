# Agent CLI Design Guide

Reference guide for building command-line tools consumed by LLM-powered agents.
These tools will be invoked programmatically via shell — not by humans in interactive terminals.

---

## Table of Contents

1. [Core Constraints](#1-core-constraints)
2. [Output Design](#2-output-design)
3. [Error Handling](#3-error-handling)
4. [Exit Codes](#4-exit-codes)
5. [Flags and Arguments](#5-flags-and-arguments)
6. [Non-Interactivity](#6-non-interactivity)
7. [Help and Self-Documentation](#7-help-and-self-documentation)
8. [Idempotency](#8-idempotency)
9. [Dry-Run and Preview](#9-dry-run-and-preview)
10. [Streaming and Large Output](#10-streaming-and-large-output)
11. [Stdin, Stdout, Stderr Separation](#11-stdin-stdout-stderr-separation)
12. [Composability](#12-composability)
13. [Authentication and Credentials](#13-authentication-and-credentials)
14. [Timeouts and Resource Limits](#14-timeouts-and-resource-limits)
15. [Versioning and Backward Compatibility](#15-versioning-and-backward-compatibility)
16. [Pre-Ship Checklist](#16-pre-ship-checklist)

---

## 1. Core Constraints

Every design decision flows from these properties of the consuming agent:

- The agent reads stdout and parses it. Unparseable stdout is a broken tool.
- The agent cannot respond to interactive prompts. Blocking on stdin is a hang.
- The agent will retry failed commands. Non-idempotent mutations cause duplicate side effects.
- The agent decides next steps based on exit codes and structured error fields. Vague errors cause wrong decisions.
- The agent learns the tool by reading `--help` output. Missing or unclear help means misuse.
- The agent may pipe output to other commands. Decorative output (colors, boxes, spinners) corrupts pipes.

---

## 2. Output Design

### 2.1 Default to JSON on Stdout

JSON is the default output format. Do not require a `--json` flag for structured output.
Optionally support `--pretty` or `--human` for developer debugging.

```
# Correct: default is JSON
$ mycli list-users
{"status":"success","data":[{"id":1,"name":"alice"}]}

# Wrong: default is pretty, agent must remember --json
$ mycli list-users
NAME    ID
alice   1
```

### 2.2 Output Envelope Schema

Every command returns a JSON object. Never a bare array, string, or number.

**Success envelope:**

```json
{
  "status": "success",
  "data": {},
  "warnings": [],
  "metadata": {
    "command": "list-users",
    "duration_ms": 142,
    "version": "1.2.0",
    "schema_version": 1
  }
}
```

**Error envelope:**

```json
{
  "status": "error",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User with id=99 does not exist",
    "recoverable": true,
    "suggested_action": "Use 'list-users' to see valid user IDs",
    "context": {
      "requested_id": 99
    }
  },
  "metadata": {
    "command": "get-user",
    "duration_ms": 12,
    "version": "1.2.0",
    "schema_version": 1
  }
}
```

### 2.3 Field Rules

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | `"success"` \| `"error"` | Yes | Always present. Branch on this first. |
| `data` | object \| array | On success | The primary payload. Type depends on command. |
| `error` | object | On error | Structured error. See §3. |
| `error.code` | string | On error | Stable enum. `UPPER_SNAKE_CASE`. Never change once shipped. |
| `error.message` | string | On error | Human/agent-readable description. May change between versions. |
| `error.recoverable` | boolean | On error | `true` = agent can retry or adjust inputs. `false` = requires human intervention. |
| `error.suggested_action` | string | Optional | Plain-language hint for what to try next. |
| `error.context` | object | Optional | Structured data relevant to the error (the invalid input, the limit that was hit, etc.). |
| `warnings` | string[] | Optional | Non-fatal issues. Array of warning messages. |
| `metadata.command` | string | Recommended | The command/subcommand that was invoked. |
| `metadata.duration_ms` | number | Optional | Wall-clock execution time. |
| `metadata.version` | string | Recommended | Tool version (SemVer). |
| `metadata.schema_version` | number | Recommended | Integer. Increment on breaking output changes. |

### 2.4 Schema Consistency Across Commands

A resource (e.g., "user") must have the same shape regardless of which command returns it.
If `list-users` returns `{"id": 1, "name": "alice"}`, then `get-user --id 1` must return
the same fields with the same types. Additional fields are acceptable; missing or renamed fields
are a breaking change.

### 2.5 Null and Empty Values

- Use `null` for absent optional fields. Do not omit the key.
- Use `[]` for empty arrays. Do not use `null`.
- Use `{}` for empty objects. Do not use `null`.
- Use `""` only when empty string is a meaningful value. Use `null` for "not set."

```json
{"name": "alice", "email": null, "tags": [], "metadata": {}}
```

### 2.6 Timestamps

Use ISO 8601 with timezone: `"2025-01-15T10:30:00Z"`. Never use locale-dependent formats.
Include timezone offset or use UTC (`Z` suffix). Never use Unix timestamps as the primary representation
(include them as a secondary field if needed for computation).

### 2.7 Enums and Constants

Use `UPPER_SNAKE_CASE` for enum values in output: `"status": "IN_PROGRESS"`, not `"in-progress"` or `"In Progress"`.
Document all valid values in help text.

---

## 3. Error Handling

### 3.1 Error Categories

Use these standard error codes. Extend with tool-specific codes as needed,
but keep the prefix convention: `CATEGORY_SPECIFIC_DETAIL`.

| Code | Recoverable | Meaning | Agent should... |
|---|---|---|---|
| `INVALID_ARGUMENT` | Yes | Bad flag value or argument | Fix the argument and retry |
| `MISSING_ARGUMENT` | Yes | Required flag/arg not provided | Add the missing argument |
| `RESOURCE_NOT_FOUND` | Yes | Target entity doesn't exist | Verify the identifier |
| `ALREADY_EXISTS` | Yes | Create target already present | Treat as success or use `--force` |
| `PERMISSION_DENIED` | No | Auth valid but insufficient | Report to user |
| `AUTH_FAILED` | No | Invalid/expired credentials | Report to user |
| `RATE_LIMITED` | Yes | Too many requests | Wait `retry_after_seconds` then retry |
| `TIMEOUT` | Yes | Operation exceeded time limit | Retry, possibly with `--timeout` increase |
| `CONFLICT` | Yes | Concurrent modification | Re-read state then retry |
| `PRECONDITION_FAILED` | Yes | Required state not met | Satisfy the precondition first |
| `INTERNAL_ERROR` | No | Unexpected tool failure | Report to user |
| `DEPENDENCY_MISSING` | No | Required external tool absent | Report to user |
| `CONFIG_ERROR` | No | Bad configuration file/env | Report to user |
| `UNSUPPORTED_OPERATION` | No | Command not available in context | Try a different approach |

### 3.2 Error Output Rules

1. Errors go to both stdout (structured JSON) and stderr (human-readable message).
2. The stdout JSON always conforms to the error envelope in §2.2. The agent parses this.
3. Stderr gets a plain-text version for logging/debugging. The agent typically ignores this.
4. Never emit only to stderr on error — the agent checks stdout first.
5. Include stack traces or debug info on stderr only, never in the JSON envelope.

### 3.3 Partial Failure

For batch operations where some items succeed and others fail, report both:

```json
{
  "status": "partial",
  "data": {
    "succeeded": [
      {"id": 1, "result": "created"},
      {"id": 2, "result": "created"}
    ],
    "failed": [
      {"id": 3, "error": {"code": "ALREADY_EXISTS", "message": "Item 3 already exists"}}
    ]
  },
  "metadata": {
    "total": 3,
    "succeeded_count": 2,
    "failed_count": 1
  }
}
```

Use exit code 0 only if all items succeed. Use a distinct exit code (e.g., 3) for partial failure.
Never silently swallow individual item failures.

---

## 4. Exit Codes

### 4.1 Exit Code Table

Assign exit codes from this table. Document them in `--help` output.

| Code | Meaning | Agent behavior |
|---|---|---|
| `0` | Success, operation completed | Proceed normally |
| `1` | General error | Parse JSON error, decide based on `error.code` |
| `2` | Usage error (bad arguments, flags) | Fix invocation syntax |
| `3` | Partial failure (some items in batch failed) | Parse `succeeded` and `failed` arrays |
| `4` | Resource not found | Verify identifiers |
| `5` | Conflict / concurrent modification | Re-read state, retry |
| `10` | Auth failure | Stop, report to user |
| `11` | Permission denied | Stop, report to user |
| `12` | Rate limited | Wait, retry |
| `20` | Timeout | Retry with longer timeout |
| `30` | Dependency missing | Stop, report to user |
| `40` | Dry-run completed (changes would be made) | Parse proposed changes |
| `124` | Timeout (coreutils convention) | Retry |
| `125` | Tool internal error | Stop, report to user |

### 4.2 Rules

- Exit code 0 means "the operation fully succeeded." Never exit 0 on partial failure.
- For dry-run: exit 0 if no changes would be made, exit 40 if changes would be made. This lets the agent branch without parsing output.
- Always pair the exit code with the structured JSON error on stdout. Exit codes are the fast-path signal; JSON is the full detail.
- Document your exit codes in `--help` under a dedicated EXIT CODES section.

---

## 5. Flags and Arguments

### 5.1 Naming

- Use `--long-form-flags` for all flags. Kebab-case.
- Short flags (e.g., `-v`) are optional aliases. Every short flag must have a long-form equivalent.
- Prefix negation flags with `--no-`: `--no-color`, `--no-pager`, `--no-cache`.
- Prefix optional feature flags with `--with-` / `--without-`: `--with-timestamps`, `--without-headers`.

### 5.2 Named vs. Positional Arguments

Prefer named flags over positional arguments.

```
# Preferred: self-documenting, order-independent
mycli copy --source file.txt --destination backup.txt

# Acceptable: single unambiguous target
mycli get-user 42

# Avoid: positional args where order conveys meaning
mycli copy file.txt backup.txt
```

Rules:
- 0 or 1 positional arguments maximum. The positional arg is the primary target/subject of the command.
- 2+ positional arguments: use named flags instead.
- Always accept the positional argument as a named flag too: `mycli get-user 42` and `mycli get-user --id 42` should both work.

### 5.3 Defaults

- Document every default value in `--help`.
- Avoid implicit defaults that change behavior in non-obvious ways.
- Provide a `--no-defaults` or `--explicit` flag that disables all default behaviors, requiring the agent to specify everything.
- When defaults depend on environment (e.g., current directory, OS), document this.

### 5.4 Mutual Exclusivity

If flags conflict, fail immediately with an error:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "--format json and --format yaml are mutually exclusive",
    "recoverable": true,
    "suggested_action": "Specify only one of: --format json, --format yaml, --format table"
  }
}
```

Do not silently pick one. Document mutual exclusivity in `--help`.

### 5.5 Boolean Flags

- `--flag` means true. `--no-flag` means false.
- Do not use `--flag=true` / `--flag=false` syntax as the primary interface. Support it as an alternative.
- Document the default state: "Enabled by default. Use --no-cache to disable."

### 5.6 Repeatable Flags

For flags that accept multiple values, support both repeated flags and comma-separated values:

```bash
# Both should work:
mycli list --tag backend --tag production
mycli list --tag backend,production
```

Document which style(s) are supported.

---

## 6. Non-Interactivity

### 6.1 Hard Rules

1. **Never block on stdin waiting for user input.** If input is needed and not provided, fail with `MISSING_ARGUMENT`.
2. **Never launch a pager** (e.g., `less`, `more`). Output all content directly to stdout.
3. **Never display interactive prompts** ("Are you sure? [y/N]"). Use `--yes` / `--force` to bypass.
4. **Never display spinners or progress bars on stdout.** Put them on stderr, and only when stderr is a TTY.
5. **Never require a browser login flow** as the only auth method. Always support token/key-based auth.
6. **Never open an external editor** (e.g., `$EDITOR`) unless explicitly requested via a flag.

### 6.2 TTY Detection

Detect whether stdout/stderr are connected to a terminal and adjust behavior:

| Condition | Behavior |
|---|---|
| stdout is TTY | May use colors, tables, human formatting |
| stdout is NOT TTY | JSON output only, no ANSI codes, no decorations |
| stderr is TTY | May show progress bars, spinners |
| stderr is NOT TTY | Plain text logging only |
| stdin is NOT TTY | Non-interactive mode. Fail if input is required but not provided via flags. |

Pseudocode:
```
if not stdout.isatty():
    output_format = "json"
    disable_colors()
    disable_pager()

if not stdin.isatty():
    interactive_mode = false
    # fail on any prompt rather than blocking
```

### 6.3 Environment Variable Detection

Detect agent/CI environments and switch to non-interactive mode automatically:

```
CI=true
GITHUB_ACTIONS=true
GITLAB_CI=true
JENKINS_URL=*
CURSOR_AGENT=true
TERM=dumb
NO_COLOR=1
```

When any of these are set, behave as if `--no-color --no-pager --no-input` were passed.

### 6.4 Confirmation Bypass

For destructive operations:

```
# Interactive (human): prompt for confirmation
$ mycli delete-all
This will delete 47 items. Are you sure? [y/N]

# Non-interactive (agent): require explicit --yes flag
$ mycli delete-all --yes
{"status":"success","data":{"deleted_count":47}}

# Non-interactive without --yes: fail, don't prompt
$ mycli delete-all
{"status":"error","error":{"code":"CONFIRMATION_REQUIRED","message":"This destructive operation requires --yes flag","recoverable":true,"suggested_action":"Re-run with --yes to confirm"}}
```

---

## 7. Help and Self-Documentation

### 7.1 --help Structure

Structure `--help` output in this order:

```
USAGE:
  mycli <command> [flags]

DESCRIPTION:
  One-line summary of what the tool does.

COMMANDS:
  list-users     List all users
  get-user       Get a single user by ID
  create-user    Create a new user
  delete-user    Delete a user

GLOBAL FLAGS:
  --help          Show this help message
  --version       Show version
  --output-format string  Output format: json (default), pretty, yaml
  --quiet         Suppress non-essential output on stderr
  --no-color      Disable colored output
  --no-pager      Disable pager
  --timeout duration  Request timeout (default: 30s)
  --verbose       Enable verbose logging on stderr

EXIT CODES:
  0   Success
  1   General error
  2   Usage error
  3   Partial failure
  4   Resource not found
  10  Auth failure
  12  Rate limited
  20  Timeout

EXAMPLES:
  # List all users as JSON
  mycli list-users

  # Get a specific user
  mycli get-user --id 42

  # Create a user with dry-run
  mycli create-user --name alice --email alice@example.com --dry-run

  # Delete with confirmation bypass
  mycli delete-user --id 42 --yes
```

### 7.2 Subcommand Help

Each subcommand has its own `--help` with:
- Usage line showing all flags
- Description of what the command does
- All flags with types, defaults, and valid values
- Exit codes specific to this command (if different from global)
- 2-4 examples showing common invocations

```
USAGE:
  mycli create-user --name <string> --email <string> [flags]

DESCRIPTION:
  Create a new user account. Returns the created user object.
  If a user with the same email exists, fails with ALREADY_EXISTS.

FLAGS:
  --name string       User's display name (required)
  --email string      User's email address (required)
  --role string       User's role: admin, member, viewer (default: member)
  --dry-run           Preview the operation without creating the user
  --idempotency-key string  Idempotency key for safe retries

EXIT CODES:
  0   User created successfully
  1   General error
  2   Invalid arguments
  4   Referenced role does not exist
  40  Dry-run: user would be created

EXAMPLES:
  mycli create-user --name alice --email alice@example.com
  mycli create-user --name bob --email bob@example.com --role admin --dry-run
```

### 7.3 Machine-Readable Help

Provide `--help-json` that returns the full command tree as structured data:

```json
{
  "name": "mycli",
  "version": "1.2.0",
  "description": "Manage user accounts",
  "global_flags": [
    {
      "name": "--output-format",
      "type": "string",
      "default": "json",
      "choices": ["json", "pretty", "yaml"],
      "description": "Output format"
    }
  ],
  "commands": [
    {
      "name": "create-user",
      "description": "Create a new user account",
      "flags": [
        {"name": "--name", "type": "string", "required": true, "description": "User's display name"},
        {"name": "--email", "type": "string", "required": true, "description": "User's email address"},
        {"name": "--role", "type": "string", "required": false, "default": "member", "choices": ["admin","member","viewer"], "description": "User's role"},
        {"name": "--dry-run", "type": "boolean", "required": false, "default": false, "description": "Preview without executing"},
        {"name": "--idempotency-key", "type": "string", "required": false, "description": "Key for safe retries"}
      ],
      "exit_codes": [
        {"code": 0, "meaning": "User created"},
        {"code": 2, "meaning": "Invalid arguments"},
        {"code": 40, "meaning": "Dry-run: changes would be made"}
      ],
      "examples": [
        "mycli create-user --name alice --email alice@example.com",
        "mycli create-user --name bob --email bob@example.com --role admin --dry-run"
      ]
    }
  ]
}
```

This lets agents introspect the tool's full interface programmatically.

### 7.4 Version Output

`--version` returns structured output:

```json
{"name": "mycli", "version": "1.2.0", "schema_version": 1}
```

Or if not in JSON mode: `mycli 1.2.0`

---

## 8. Idempotency

### 8.1 Classification

Classify every command by idempotency:

| Type | Idempotent? | Example | Notes |
|---|---|---|---|
| Read | Yes (inherently) | `list-users`, `get-user` | Always safe to retry |
| Create | No (by default) | `create-user` | Needs idempotency key or upsert semantics |
| Update (full replace) | Yes | `update-user --id 1 --name alice` | Same input → same state |
| Update (relative) | No | `increment-counter --id 1` | Each call changes state further |
| Delete | Yes (naturally) | `delete-user --id 1` | Deleting already-deleted = success |
| Upsert | Yes | `ensure-user --email alice@example.com` | Create if missing, no-op if exists |

### 8.2 Idempotency Keys

For non-idempotent mutations, accept `--idempotency-key <string>`:

```bash
mycli create-user --name alice --email alice@example.com --idempotency-key req-abc-123
```

Behavior:
1. First call: execute normally, store the key + result.
2. Subsequent calls with same key: return the stored result without re-executing.
3. Same key but different parameters: return error `IDEMPOTENCY_KEY_CONFLICT`.
4. Keys expire after a documented TTL (default: 24 hours).

### 8.3 "Already Exists" Handling

When creating something that already exists, the response must distinguish
between "created now" and "was already there":

```json
{
  "status": "success",
  "data": {
    "user": {"id": 1, "name": "alice"},
    "created": false,
    "existing": true
  }
}
```

Exit code 0 in both cases (the postcondition "resource exists" is satisfied).
Only use `ALREADY_EXISTS` error if the caller explicitly wants create-only semantics
and the tool offers separate `create` vs. `ensure` commands.

### 8.4 Delete Idempotency

Deleting a resource that doesn't exist should succeed (exit 0) with a note:

```json
{
  "status": "success",
  "data": {
    "deleted": false,
    "reason": "Resource did not exist"
  }
}
```

The postcondition "resource does not exist" is satisfied. Don't error on this.
If the caller needs strict delete-only-if-exists semantics, provide a `--strict` flag
that changes the behavior to return `RESOURCE_NOT_FOUND`.

---

## 9. Dry-Run and Preview

### 9.1 Flag Convention

Use `--dry-run` as the standard flag name. Accept `--plan` as an alias if the tool
performs infrastructure-like operations.

### 9.2 Dry-Run Output

Return the same envelope as a real execution, with additional fields:

```json
{
  "status": "success",
  "dry_run": true,
  "data": {
    "changes": [
      {
        "action": "create",
        "resource_type": "user",
        "resource_id": null,
        "planned_attributes": {"name": "alice", "email": "alice@example.com", "role": "member"}
      }
    ],
    "summary": {
      "create": 1,
      "update": 0,
      "delete": 0,
      "unchanged": 0
    }
  }
}
```

### 9.3 Dry-Run Exit Codes

- Exit `0` if dry-run determines no changes would be made.
- Exit `40` if dry-run determines changes would be made.
- Exit `1`+ if the dry-run itself fails (e.g., validation error, unreachable dependency).

This lets the agent branch on exit code alone:

```bash
mycli apply --dry-run
if [ $? -eq 0 ]; then
  echo "No changes needed"
elif [ $? -eq 40 ]; then
  echo "Changes pending, applying..."
  mycli apply --yes
else
  echo "Dry-run failed"
fi
```

### 9.4 Diff Output

For update operations, include a diff showing old vs. new values:

```json
{
  "action": "update",
  "resource_type": "config",
  "resource_id": "cfg-123",
  "diff": {
    "replicas": {"old": 2, "new": 4},
    "image": {"old": "app:v1.0", "new": "app:v1.1"}
  },
  "unchanged": ["port", "memory_limit"]
}
```

### 9.5 Saved Plans

For complex operations, support saving the dry-run output and applying it exactly:

```bash
# Preview and save
mycli deploy --dry-run --plan-output plan.json

# Apply the exact plan (no drift)
mycli deploy --plan-input plan.json --yes
```

The tool should reject a plan if the underlying state has changed since the plan was generated.
Include a state hash or timestamp in the plan for this check.

---

## 10. Streaming and Large Output

### 10.1 NDJSON for Streaming

For commands that produce incremental output (logs, build events, long-running scans),
use NDJSON: one valid JSON object per line, separated by `\n`.

```
{"type":"progress","percent":25,"message":"Scanning /src..."}
{"type":"progress","percent":50,"message":"Scanning /lib..."}
{"type":"result","path":"/src/main.rs","findings":[]}
{"type":"result","path":"/lib/utils.rs","findings":[{"severity":"warn","line":42}]}
{"type":"summary","total_files":2,"total_findings":1,"duration_ms":340}
```

Rules:
- Every line is a complete JSON object. No multi-line objects.
- Include a `type` field as discriminator for heterogeneous streams.
- End the stream with a `summary` or `complete` event.
- On error mid-stream, emit an error event and then terminate:
  ```
  {"type":"error","code":"SCAN_FAILED","message":"Permission denied on /etc/shadow"}
  ```

### 10.2 Pagination

For commands returning collections, support cursor-based pagination:

```bash
mycli list-users --limit 100
```

Response:

```json
{
  "status": "success",
  "data": {
    "items": [...],
    "has_more": true,
    "next_cursor": "eyJpZCI6MTAwfQ=="
  }
}
```

Next page:

```bash
mycli list-users --limit 100 --cursor eyJpZCI6MTAwfQ==
```

Rules:
- Default `--limit` to a reasonable value (100-1000). Document it.
- Cursors are opaque strings. Don't document their internal format.
- When `has_more` is `false`, `next_cursor` is `null`.
- Support `--all` to automatically paginate and return everything (with a warning for very large sets).

### 10.3 Output Truncation

If output would be extremely large, truncate with a signal:

```json
{
  "status": "success",
  "data": {
    "items": [...first 1000...],
    "truncated": true,
    "total_count": 50000,
    "message": "Output truncated at 1000 items. Use --limit and --cursor to paginate."
  }
}
```

Never silently truncate. Always set `truncated: true` so the agent knows.

---

## 11. Stdin, Stdout, Stderr Separation

### 11.1 Channel Assignments

| Channel | Content | Consumer |
|---|---|---|
| **stdout** | Structured JSON output (the result) | Agent parses this |
| **stderr** | Logs, progress, debug info, human-readable errors | Agent ignores or logs for debugging |
| **stdin** | Piped input data (when supported) | Agent writes to this |

### 11.2 Rules

1. **stdout is sacred.** Only the JSON envelope goes here. Never mix in log lines, warnings, or progress.
2. **stderr is for humans and debug logs.** Progress bars, verbose logging (`--verbose`), and human-readable error messages go here.
3. **Duplicate errors to both channels**: JSON error on stdout (for parsing) + plain text on stderr (for logs).
4. **Never require stderr parsing for correct behavior.** The agent should be able to ignore stderr entirely and still function.
5. **Stdin input uses `-` convention**: `mycli import --file -` means "read from stdin."

### 11.3 Verbose/Debug Logging

```bash
# Normal: stdout = JSON only, stderr = quiet
mycli list-users

# Verbose: stdout = JSON, stderr = info-level logs
mycli list-users --verbose

# Debug: stdout = JSON, stderr = debug-level logs with timestamps
mycli list-users --debug
```

Verbose/debug output goes exclusively to stderr. The JSON on stdout is identical
regardless of verbosity level.

---

## 12. Composability

### 12.1 Piping Support

Design commands so output from one can feed into another:

```bash
# List IDs, then fetch details for each
mycli list-users | mycli get-users --ids-from-stdin

# Export then import
mycli export --format json | other-tool import --format json

# Filter with jq then act
mycli list-users | jq '.data.items[] | select(.role == "admin") | .id' | mycli delete-users --ids-from-stdin
```

### 12.2 Stdin Input

Support `--input-file -` or a dedicated `--from-stdin` flag for accepting piped input.
Auto-detect stdin when it's not a TTY:

```bash
# Explicit
echo '{"name":"alice"}' | mycli create-user --from-stdin

# File input
mycli create-user --input-file user.json
```

### 12.3 Output Filtering

Provide built-in field selection to reduce output before piping:

```bash
# Return only specific fields
mycli list-users --fields id,name,email

# Return only IDs (useful for piping)
mycli list-users --fields id --flat
# Output: one ID per line, no JSON envelope
```

The `--flat` flag outputs raw values (one per line) instead of JSON, specifically for piping to tools that expect plain text.

### 12.4 Batch Input

For commands that operate on multiple items, accept batch input:

```bash
# From a file
mycli delete-users --ids-file user_ids.txt

# From stdin (one per line)
cat user_ids.txt | mycli delete-users --ids-from-stdin

# Inline
mycli delete-users --id 1 --id 2 --id 3
```

---

## 13. Authentication and Credentials

### 13.1 Credential Precedence

Support credentials from multiple sources with this precedence order (highest first):

1. Explicit flags (`--token <value>`)
2. Stdin (`--token-stdin`, piped)
3. Environment variables (`MYCLI_TOKEN`)
4. Credential file (`~/.config/mycli/credentials.json`)
5. System keychain / credential helper
6. Instance metadata (cloud environments)

Document this order in `--help`.

### 13.2 Rules

1. **Never require interactive login as the only auth method.** Always support token/key-based auth.
2. **Never accept secrets as positional arguments.** They leak into shell history and process tables.
3. **Prefer `--token-stdin` over `--token <value>` for secrets**, since flag values appear in `ps` output:
   ```bash
   echo $MYCLI_TOKEN | mycli --token-stdin list-users
   ```
4. **Support `--credentials-file <path>`** for service account / automation scenarios.
5. **Credential files must have restricted permissions.** Warn (on stderr) if permissions are too open:
   ```
   WARNING: /home/user/.config/mycli/credentials.json has mode 0644. Expected 0600.
   ```
6. **Support token refresh** for long-running operations. If a token expires mid-operation,
   refresh it transparently or fail with `AUTH_FAILED` and `suggested_action: "Refresh your token"`.

### 13.3 Auth Error Output

```json
{
  "status": "error",
  "error": {
    "code": "AUTH_FAILED",
    "message": "The provided token is expired",
    "recoverable": false,
    "suggested_action": "Set MYCLI_TOKEN to a valid token or run 'mycli auth refresh'",
    "context": {
      "token_source": "environment_variable",
      "token_prefix": "mct_...a3f",
      "expired_at": "2025-01-14T23:59:59Z"
    }
  }
}
```

Never include the full token in error output. Show a prefix/suffix for identification only.

---

## 14. Timeouts and Resource Limits

### 14.1 Timeout Flags

```bash
mycli deploy --timeout 120s      # seconds
mycli deploy --timeout 5m        # minutes
mycli deploy --timeout 2h        # hours (for long operations)
```

- Default: 30s for network operations, 0 (no timeout) for local operations. Document the default.
- Parse duration strings with unit suffixes: `s`, `m`, `h`.
- On timeout, exit with code 20 (or 124 for coreutils compatibility).

### 14.2 Timeout Error Output

```json
{
  "status": "error",
  "error": {
    "code": "TIMEOUT",
    "message": "Operation timed out after 30s",
    "recoverable": true,
    "suggested_action": "Retry with --timeout 60s or check service health",
    "context": {
      "timeout_ms": 30000,
      "elapsed_ms": 30012,
      "operation": "deploy"
    }
  }
}
```

### 14.3 Graceful Shutdown

Handle `SIGTERM` and `SIGINT`:

1. Stop accepting new work.
2. Attempt to complete in-flight operations within a grace period (default: 10s).
3. If grace period expires, abort and emit partial results if possible.
4. Exit with appropriate code.

Provide `--grace-period <duration>` for tuning.

### 14.4 Resource Limits

For operations that might consume excessive resources, provide guards:

```bash
mycli scan --max-files 10000 --max-depth 10 --max-file-size 10MB
```

When a limit is hit, emit a warning (not an error) and continue with the bounded set:

```json
{
  "status": "success",
  "data": {...},
  "warnings": ["Scan stopped at --max-files limit (10000). 3420 additional files were not scanned."]
}
```

---

## 15. Versioning and Backward Compatibility

### 15.1 What Constitutes a Breaking Change

**Breaking** (requires major version bump):
- Removing or renaming a JSON output field
- Changing the type of a JSON output field
- Changing the meaning of an exit code
- Removing a flag or command
- Changing a flag's type or semantics
- Renaming an error code

**Non-breaking** (minor or patch):
- Adding new JSON output fields
- Adding new commands or flags
- Adding new error codes
- Adding new exit codes (in unoccupied ranges)
- Changing human-readable error messages
- Changing stderr output format

### 15.2 Schema Versioning

Include `schema_version` in output metadata. Increment it on any output change (even non-breaking additions):

```json
{
  "metadata": {
    "version": "2.1.0",
    "schema_version": 3
  }
}
```

Support `--output-schema-version <N>` to request a specific schema version for backward compatibility:

```bash
mycli list-users --output-schema-version 2
```

If the requested version is no longer supported, fail with:

```json
{
  "status": "error",
  "error": {
    "code": "UNSUPPORTED_SCHEMA_VERSION",
    "message": "Schema version 1 is no longer supported. Minimum supported: 2",
    "context": {
      "requested": 1,
      "minimum_supported": 2,
      "current": 3
    }
  }
}
```

### 15.3 Deprecation

When deprecating a flag, command, or output field:

1. Add a warning to stderr: `DEPRECATED: --old-flag will be removed in v3.0. Use --new-flag instead.`
2. Add a `deprecation_warnings` array to the JSON output metadata:
   ```json
   {
     "metadata": {
       "deprecation_warnings": [
         {"flag": "--old-flag", "replacement": "--new-flag", "removal_version": "3.0.0"}
       ]
     }
   }
   ```
3. Continue supporting the deprecated feature for at least one major version.

---

## 16. Pre-Ship Checklist

Verify each item before releasing a CLI tool for agent consumption.

### Output

- [ ] Default output format is JSON (no `--json` flag required)
- [ ] All commands use the standard envelope (`status`, `data`/`error`, `metadata`)
- [ ] `status` is always `"success"`, `"error"`, or `"partial"`
- [ ] Same resource type has identical schema across all commands
- [ ] Timestamps are ISO 8601 with timezone
- [ ] Enum values are `UPPER_SNAKE_CASE`
- [ ] Null/empty values follow §2.5 conventions
- [ ] `schema_version` is included in metadata

### Errors

- [ ] All errors include `code`, `message`, `recoverable`
- [ ] Error codes are `UPPER_SNAKE_CASE` and documented
- [ ] Errors appear on both stdout (JSON) and stderr (plain text)
- [ ] Partial failures return `status: "partial"` with both succeeded/failed arrays
- [ ] No stack traces or internal details leak into stdout JSON

### Exit Codes

- [ ] Exit codes follow §4.1 table
- [ ] Exit 0 only on full success
- [ ] Dry-run uses exit 0 (no changes) vs 40 (changes would be made)
- [ ] Exit codes are documented in `--help`

### Flags

- [ ] All flags have `--long-form` names
- [ ] No more than 1 positional argument per command
- [ ] Mutually exclusive flags produce clear errors
- [ ] All defaults are documented
- [ ] `--no-defaults` / `--explicit` flag is available

### Non-Interactivity

- [ ] Tool never blocks on stdin prompts
- [ ] Tool never launches a pager
- [ ] Tool never opens an editor or browser (unless explicitly flagged)
- [ ] TTY detection adjusts output format automatically
- [ ] CI/agent environment variables are detected
- [ ] Destructive operations require `--yes` (fail without it in non-interactive mode)
- [ ] `--no-color`, `--no-pager`, `--no-input` flags exist

### Help

- [ ] `--help` includes: USAGE, DESCRIPTION, COMMANDS, FLAGS, EXIT CODES, EXAMPLES
- [ ] Every subcommand has its own `--help`
- [ ] `--help-json` returns machine-readable command schema
- [ ] `--version` returns structured version info
- [ ] Examples show common agent use cases (JSON output, piping, dry-run)

### Idempotency

- [ ] Read commands are inherently idempotent
- [ ] Create commands support `--idempotency-key` or upsert semantics
- [ ] Delete commands succeed on already-deleted resources (exit 0)
- [ ] Response distinguishes "created now" vs "already existed"

### Dry-Run

- [ ] `--dry-run` is supported for all mutation commands
- [ ] Dry-run output shows planned changes with diffs
- [ ] Dry-run exit codes distinguish "no changes" (0) from "changes pending" (40)

### Composability

- [ ] Stdin input supported via `--from-stdin` or `--input-file -`
- [ ] Pagination uses cursor-based approach with `--limit` and `--cursor`
- [ ] `--fields` flag for output filtering
- [ ] Batch input supported for multi-item operations

### Auth

- [ ] Token-based auth supported (not just interactive login)
- [ ] Credential precedence: flags → stdin → env → file → system
- [ ] Secrets never appear in flag values visible to `ps`
- [ ] Auth errors never expose full credentials

### Operational

- [ ] `--timeout` with duration suffixes is supported
- [ ] SIGTERM/SIGINT handled gracefully
- [ ] Resource limits are configurable
- [ ] Breaking changes follow SemVer
- [ ] `schema_version` tracks output format changes
- [ ] Deprecated features emit structured warnings

---

## Appendix A: Output Envelope — Quick Reference

Copy-paste these templates.

### Success

```json
{
  "status": "success",
  "data": {
    "items": [],
    "has_more": false,
    "next_cursor": null
  },
  "warnings": [],
  "metadata": {
    "command": "list-items",
    "duration_ms": 42,
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

### Error

```json
{
  "status": "error",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Item with id=99 does not exist",
    "recoverable": true,
    "suggested_action": "Use 'list-items' to see valid IDs",
    "context": {"requested_id": 99}
  },
  "metadata": {
    "command": "get-item",
    "duration_ms": 12,
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

### Partial Failure

```json
{
  "status": "partial",
  "data": {
    "succeeded": [{"id": 1, "result": "deleted"}],
    "failed": [{"id": 2, "error": {"code": "PERMISSION_DENIED", "message": "Cannot delete item 2"}}]
  },
  "metadata": {
    "command": "delete-items",
    "total": 2,
    "succeeded_count": 1,
    "failed_count": 1,
    "duration_ms": 87,
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

### Dry-Run

```json
{
  "status": "success",
  "dry_run": true,
  "data": {
    "changes": [
      {"action": "create", "resource_type": "item", "planned_attributes": {"name": "widget"}},
      {"action": "update", "resource_type": "config", "resource_id": "cfg-1", "diff": {"replicas": {"old": 2, "new": 4}}},
      {"action": "delete", "resource_type": "item", "resource_id": "item-old"}
    ],
    "summary": {"create": 1, "update": 1, "delete": 1, "unchanged": 0}
  },
  "metadata": {
    "command": "apply",
    "version": "1.0.0",
    "schema_version": 1
  }
}
```

### Streaming (NDJSON)

```
{"type":"progress","percent":0,"message":"Starting scan..."}
{"type":"result","path":"/src/main.rs","findings":[]}
{"type":"result","path":"/src/lib.rs","findings":[{"severity":"warn","line":42,"message":"unused import"}]}
{"type":"summary","total_files":2,"total_findings":1,"duration_ms":340}
```

---

## Appendix B: Exit Code Table — Quick Reference

| Code | Meaning | Recoverable |
|---|---|---|
| 0 | Success | — |
| 1 | General error | Check JSON |
| 2 | Usage / argument error | Yes — fix invocation |
| 3 | Partial failure | Yes — check succeeded/failed |
| 4 | Resource not found | Yes — verify ID |
| 5 | Conflict | Yes — re-read and retry |
| 10 | Auth failure | No |
| 11 | Permission denied | No |
| 12 | Rate limited | Yes — wait and retry |
| 20 | Timeout | Yes — retry with longer timeout |
| 30 | Dependency missing | No |
| 40 | Dry-run: changes would be made | — (informational) |
| 124 | Timeout (coreutils compat) | Yes |
| 125 | Internal error | No |

---

## Appendix C: Error Code Registry — Quick Reference

| Code | Recoverable | Agent Action |
|---|---|---|
| `INVALID_ARGUMENT` | Yes | Fix the argument |
| `MISSING_ARGUMENT` | Yes | Add the missing flag |
| `RESOURCE_NOT_FOUND` | Yes | Verify the identifier |
| `ALREADY_EXISTS` | Yes | Treat as success or use `--force` |
| `PERMISSION_DENIED` | No | Report to user |
| `AUTH_FAILED` | No | Report to user |
| `RATE_LIMITED` | Yes | Wait `retry_after_seconds` |
| `TIMEOUT` | Yes | Retry with longer `--timeout` |
| `CONFLICT` | Yes | Re-read state, retry |
| `PRECONDITION_FAILED` | Yes | Satisfy the precondition |
| `CONFIRMATION_REQUIRED` | Yes | Re-run with `--yes` |
| `IDEMPOTENCY_KEY_CONFLICT` | No | Different params sent with same key |
| `UNSUPPORTED_SCHEMA_VERSION` | No | Update to supported version |
| `INTERNAL_ERROR` | No | Report to user |
| `DEPENDENCY_MISSING` | No | Install dependency |
| `CONFIG_ERROR` | No | Fix configuration |
| `UNSUPPORTED_OPERATION` | No | Use different approach |