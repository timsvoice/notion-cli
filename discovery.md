# Notion CLI (Agent-Optimized) - Discovery

## Objective
Build a complete Notion CLI optimized for coding agents: non-interactive, JSON envelope output by default, deterministic behavior, explicit pagination, safe retries, full endpoint coverage, forward-compatible, and explicit handling for long-running or async operations.

## Context and Constraints
- Base API: https://api.notion.com/v1
- Required headers: Authorization (Bearer), Notion-Version, Content-Type: application/json
- Default Notion API version: 2025-09-03 (configurable)
- Rate limits: 3 req/s average; 429 includes Retry-After
- Many endpoints are cursor-paginated
- Resources must be shared with integration, or APIs return 404/403

## SDK Alignment (notion-sdk-js learnings)
- Endpoint groups: blocks, pages, databases, dataSources, users, comments, fileUploads, search, oauth
- OAuth: /oauth/token, /oauth/introspect, /oauth/revoke. Refresh is a grant type to /oauth/token, not a separate endpoint.
- Data source templates: GET /v1/data_sources/{data_source_id}/templates (per data source)
- File upload send uses multipart/form-data
- SDK offers a generic request() for forward-compat; CLI should mirror
- SDK validates request paths to prevent path traversal (.., encoded)
- SDK provides paginate helpers: iteratePaginatedAPI, collectPaginatedAPI

## Runtime and CLI Framework (Chosen)
- Runtime: Node.js + TypeScript
- CLI framework: commander
- Rationale: aligns with notion-sdk-js patterns and faster iteration for agent

## Core Agent CLI Constraints (Guide-Aligned)
- Default stdout is JSON envelope; no raw non-JSON output unless explicitly requested
- No interactive prompts; fail with structured errors
- stdout is machine-readable only; stderr for logs/debug
- Agent depends on exit codes for control flow
- `--help` and `--help-json` must fully describe commands

## Output Envelope Rules (Chosen)
- Always return an envelope object with:
  - status: "success" | "error" | "partial"
  - data (on success or partial)
  - error (on error)
  - warnings (array)
  - metadata: command, duration_ms, version, schema_version
- Never return a bare array/string
- Timestamps are ISO 8601 with timezone
- Enum values in output are UPPER_SNAKE_CASE

## Output Schema (Error Codes)
- error.code is stable and UPPER_SNAKE_CASE
- See Error Code Registry below

## Exit Codes (Guide-Aligned)
- 0 success
- 1 general error
- 2 usage/argument error
- 3 partial failure
- 4 resource not found
- 5 conflict
- 10 auth failure
- 11 permission denied
- 12 rate limited
- 20 timeout
- 30 dependency missing
- 40 dry-run changes would be made
- 124 timeout (coreutils compat)
- 125 internal error

## Configuration Model (Chosen)
- Config file: JSON
- Default path: ~/.config/notion-cli/config.json
- Profiles: multiple tokens and default version/output flags
- Precedence: CLI flags > env vars > config file

## Authentication (Guide-Aligned)
- Credential precedence: flags > stdin > env > credentials file
- Support `--token-stdin` to avoid leaking secrets in process list
- Never accept secrets as positional args

## Endpoint Matrix (SDK-Verified)
OAuth
- oauth token -> POST /v1/oauth/token
- oauth introspect -> POST /v1/oauth/introspect
- oauth revoke -> POST /v1/oauth/revoke

Blocks
- blocks get -> GET /v1/blocks/{block_id}
- blocks update -> PATCH /v1/blocks/{block_id}
- blocks delete -> DELETE /v1/blocks/{block_id}
- blocks list-children -> GET /v1/blocks/{block_id}/children
- blocks append-children -> PATCH /v1/blocks/{block_id}/children

Pages
- pages create -> POST /v1/pages
- pages get -> GET /v1/pages/{page_id}
- pages update -> PATCH /v1/pages/{page_id}
- pages move -> POST /v1/pages/{page_id}/move
- pages get-property -> GET /v1/pages/{page_id}/properties/{property_id}

Databases
- databases get -> GET /v1/databases/{database_id}
- databases create -> POST /v1/databases
- databases update -> PATCH /v1/databases/{database_id}

Data Sources
- data-sources get -> GET /v1/data_sources/{data_source_id}
- data-sources query -> POST /v1/data_sources/{data_source_id}/query
- data-sources create -> POST /v1/data_sources
- data-sources update -> PATCH /v1/data_sources/{data_source_id}
- data-sources list-templates -> GET /v1/data_sources/{data_source_id}/templates

Comments
- comments create -> POST /v1/comments
- comments list -> GET /v1/comments
- comments get -> GET /v1/comments/{comment_id}

File Uploads
- file-uploads create -> POST /v1/file_uploads
- file-uploads send -> POST /v1/file_uploads/{id}/send (multipart/form-data)
- file-uploads complete -> POST /v1/file_uploads/{id}/complete
- file-uploads get -> GET /v1/file_uploads/{id}
- file-uploads list -> GET /v1/file_uploads

Search
- search -> POST /v1/search

Users
- users list -> GET /v1/users
- users get -> GET /v1/users/{user_id}
- users me -> GET /v1/users/me

Forward-compat
- request passthrough -> notion request --method ... --path ... --body ...

## Command Syntax (Guide-Aligned)
- Prefer named flags; allow one positional ID maximum
- Every positional argument also accepted as named flag

Examples
- notion pages get <page_id>  # also supports --id
- notion pages create --parent <page|data_source> --properties @props.json
- notion data-sources query <id> --filter @filter.json --sorts @sorts.json
- notion blocks append-children <block_id> --children @children.json
- notion search --query "text" --filter @filter.json

## Input JSON Schemas (Chosen)
- Define minimal JSON schemas in `schemas/` for:
  - pages create/update
  - blocks append/update
  - data-sources query
  - databases create/update
  - comments create
  - file uploads create/complete
- Validate inputs before request; allow `--no-validate` override

## Idempotency (Guide-Aligned)
- Read commands: idempotent
- Mutations: accept `--idempotency-key` where applicable
- Delete: success if already deleted unless `--strict`
- Create: optionally support "ensure" semantics or return created=false

## Dry-Run (Guide-Aligned)
- `--dry-run` supported for all mutations
- Exit 0 if no changes; exit 40 if changes would be made
- Dry-run output includes planned changes and diffs

## Long-Running / Async Operations (Agent-Optimized)
Problem: agents should not block on slow or eventual operations.

Design
- Default: return immediately with an operation receipt for async-capable commands
- Async flag: --async (for large queries, file uploads, bulk operations)
- Polling commands:
  - ops get <op_id>
  - ops wait <op_id> --timeout <seconds>
- Receipts include: op_id, type, resource_id, status, created_at
- Polling honors Retry-After, supports backoff, returns terminal status

Targets
- File uploads: create, send, complete can be async; status via file-uploads get
- Bulk pagination: --all --async streams to file and returns receipt

## Ops Registry (Chosen)
- Storage: JSONL file at ~/.config/notion-cli/ops.jsonl
- Retention: 30 days, cleanup on write
- op_id: UUIDv4

## File Upload Chunking (Chosen)
- Chunk size: 5 MB default
- Resume: retry failed chunks up to max retries
- Chunk size configurable via flag/env

## Error Code Registry (Guide-Aligned)
- INVALID_ARGUMENT
- MISSING_ARGUMENT
- RESOURCE_NOT_FOUND
- ALREADY_EXISTS
- PERMISSION_DENIED
- AUTH_FAILED
- RATE_LIMITED
- TIMEOUT
- CONFLICT
- PRECONDITION_FAILED
- CONFIRMATION_REQUIRED
- IDEMPOTENCY_KEY_CONFLICT
- UNSUPPORTED_SCHEMA_VERSION
- INTERNAL_ERROR
- DEPENDENCY_MISSING
- CONFIG_ERROR
- UNSUPPORTED_OPERATION

## Acceptance Criteria by Resource (Guide-Aligned)
Global/Core
- All commands return JSON envelope and stable exit codes
- Path traversal rejected locally
- --all uses cursor iteration; --ndjson streams items in order
- Retry/backoff handles 429 and transient 5xx
- stdout only JSON envelope; stderr for logs
- --help and --help-json present and complete

Blocks
- CRUD + children list/append work
- Append enforces 100 block max and nesting limits
- Retrieve children is only one level; recursion optional helper

Pages
- Create under page or data source; update properties; move page
- Property-item endpoint used for long lists (>25)
- Archive/unarchive via update

Databases
- Create, retrieve, update metadata
- Schema changes go through data sources

Data Sources
- Create, update, query, list templates
- Query supports filter/sort/filter_properties

Comments
- Create, list, get; validate parent vs discussion_id exclusivity

File Uploads
- Full lifecycle, multipart send, status polling

Search
- Full search with pagination

Users
- List, get, me

OAuth
- Token, introspect, revoke; refresh via token grant

## Next Steps
- Translate this discovery into plan.md and implementation.md
- Define JSON schemas for inputs and receipts
