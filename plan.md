# Notion CLI (Agent-Optimized) - Plan

## Objective
Deliver a complete, non-interactive Notion CLI optimized for coding agents. The CLI defaults to JSON envelope output, supports explicit pagination, safe retries, forward-compat requests, and explicit handling for long-running/async operations.

## Success Criteria
- Full API surface coverage aligned with notion-sdk-js endpoint set.
- JSON envelope output on stdout by default; NDJSON for streaming.
- Stable exit codes and error envelopes per guide.
- Safe pagination, retries, and path validation.
- Async model with operation receipts and polling commands.
- `--help` and `--help-json` fully describe interface.

## Decisions Locked
- Runtime: Node.js + TypeScript
- CLI framework: commander
- Config file: JSON at ~/.config/notion-cli/config.json
- Output envelope: always JSON object with status/data/error/warnings/metadata
- Ops registry: ~/.config/notion-cli/ops.jsonl, 30-day retention, UUIDv4
- File upload chunking: 5 MB default, configurable
- Command syntax: prefer flags; allow one positional ID and also accept named flag
- Schemas: JSON schemas in `schemas/` with validation (override via --no-validate)

## CLI Architecture
- **Command groups**: blocks, pages, databases, data-sources, comments, file-uploads, search, users, oauth, ops, request
- **Core modules**:
  - HTTP client: base URL, headers, auth, versioning
  - Request builder: JSON parsing, validation, path safety
  - Pagination engine: cursor iteration, --all, --ndjson
  - Error mapping: Notion errors -> error.code enums
  - Async ops: receipt storage, polling, wait
  - Output: JSON envelope / NDJSON stream
  - Help: --help and --help-json generator

## Configuration
- **Environment**: NOTION_TOKEN, NOTION_VERSION, NOTION_TIMEOUT, NOTION_RETRIES
- **Config file**: profiles with token/version/output defaults
- **Precedence**: CLI flags > env > config

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

## Output Contract
- Always emit JSON envelope on stdout
- Errors include: code, message, recoverable, suggested_action, context
- Include metadata: command, duration_ms, version, schema_version
- NDJSON mode: one JSON object per line with type field; end with summary

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

## Long-Running / Async Model
- `--async` flag on supported commands (file uploads, large --all queries)
- `ops get <op_id>` for polling status
- `ops wait <op_id> --timeout <sec>` for blocking mode
- Receipts stored in ops registry
- Polling honors Retry-After and backoff

## Command Map (Integrated)

### Global Flags
- --help
- --help-json
- --version
- --token
- --token-stdin
- --profile
- --notion-version
- --timeout
- --retries
- --output-file
- --pretty
- --ndjson
- --no-validate
- --debug / --verbose / --quiet

### OAuth
- oauth token
  - Flags: --grant-type, --code, --redirect-uri, --refresh-token, --external-account
- oauth introspect
  - Flags: --token
- oauth revoke
  - Flags: --token

### Users
- users list
  - Flags: --page-size, --start-cursor, --all
- users get <user_id>
  - Flags: --id
- users me

### Search
- search
  - Flags: --query, --filter, --sort, --page-size, --start-cursor, --all

### Pages
- pages create
  - Flags: --parent, --properties, --children, --icon, --cover, --dry-run, --idempotency-key
- pages get <page_id>
  - Flags: --id
- pages update <page_id>
  - Flags: --id, --properties, --archived, --in-trash, --icon, --cover, --dry-run, --idempotency-key
- pages move <page_id>
  - Flags: --id, --parent, --dry-run, --idempotency-key
- pages get-property <page_id> <property_id>
  - Flags: --id, --property-id

### Blocks
- blocks get <block_id>
  - Flags: --id
- blocks update <block_id>
  - Flags: --id, --data, --dry-run, --idempotency-key
- blocks delete <block_id>
  - Flags: --id, --dry-run
- blocks list-children <block_id>
  - Flags: --id, --page-size, --start-cursor, --all
- blocks append-children <block_id>
  - Flags: --id, --children, --dry-run, --idempotency-key

### Databases
- databases get <database_id>
  - Flags: --id
- databases create
  - Flags: --parent, --title, --properties, --icon, --cover, --description, --dry-run, --idempotency-key
- databases update <database_id>
  - Flags: --id, --title, --description, --icon, --cover, --dry-run, --idempotency-key

### Data Sources
- data-sources get <data_source_id>
  - Flags: --id
- data-sources query <data_source_id>
  - Flags: --id, --filter, --sorts, --page-size, --start-cursor, --all
- data-sources create
  - Flags: --parent, --title, --properties, --icon, --cover, --dry-run, --idempotency-key
- data-sources update <data_source_id>
  - Flags: --id, --title, --properties, --description, --icon, --cover, --dry-run, --idempotency-key
- data-sources list-templates <data_source_id>
  - Flags: --id, --page-size, --start-cursor, --all

### Comments
- comments create
  - Flags: --parent, --discussion-id, --rich-text, --dry-run, --idempotency-key
- comments list
  - Flags: --block-id, --page-size, --start-cursor, --all
- comments get <comment_id>
  - Flags: --id

### File Uploads
- file-uploads create
  - Flags: --file-name, --content-type, --size, --dry-run, --idempotency-key
- file-uploads send <file_upload_id>
  - Flags: --id, --file, --chunk-size, --dry-run
- file-uploads complete <file_upload_id>
  - Flags: --id, --dry-run
- file-uploads get <file_upload_id>
  - Flags: --id
- file-uploads list
  - Flags: --status, --page-size, --start-cursor, --all

### Ops
- ops get <op_id>
  - Flags: --id
- ops wait <op_id>
  - Flags: --id, --timeout

### Forward-Compat
- request
  - Flags: --method, --path, --query, --body

## Endpoint Coverage Plan
OAuth
- oauth token, introspect, revoke

Blocks
- get, update, delete, list-children, append-children

Pages
- create, get, update, move, get-property

Databases
- get, create, update

Data Sources
- get, query, create, update, list-templates

Comments
- create, list, get

File Uploads
- create, send (multipart), complete, get, list

Search
- search

Users
- list, get, me

Forward-compat
- request passthrough: method/path/body/query

## Validation Rules
- Reject path traversal in any path parameter
- JSON input must be valid and match expected schema
- Required headers always set
- Limits enforced where needed (block append 100, pagination bounds)
- Mutual exclusivity enforced and documented

## Error Handling
- Parse Notion API error body and map to error.code enums
- Include request_id in error JSON when present
- Retry on 429 and transient 5xx with backoff
- Stderr contains human-readable error; stdout retains JSON envelope

## Idempotency and Dry-Run
- Mutations accept `--idempotency-key`
- Delete is idempotent unless `--strict`
- `--dry-run` supported for all mutations; exit 0 if no changes, 40 if changes

## Help and Documentation
- `--help` includes: usage, description, commands, flags, exit codes, examples
- Subcommand help includes flags, defaults, exit codes, examples
- `--help-json` returns machine-readable command tree
- `--version` outputs structured JSON (name, version, schema_version)

## Phased Implementation Plan

### Phase 1: Foundation
- CLI scaffold and command routing
- HTTP client with auth, headers, versioning
- JSON input handling and output formatting (envelope)
- Path validation
- Error mapping and exit codes
- Help output and help-json generator

### Phase 2: Read-Only Core
- Users (list, get, me)
- Search
- Pages get + property get
- Blocks get + list-children
- Data sources get + query
- NDJSON streaming and pagination

### Phase 3: Write Operations
- Pages create/update/move
- Blocks append/update/delete
- Comments create
- Dry-run and idempotency key support

### Phase 4: Database & Data Source Management
- Databases create/update
- Data sources create/update/list-templates

### Phase 5: File Uploads
- Create upload
- Multipart send
- Complete upload
- Status polling + async receipts

### Phase 6: OAuth
- Token, introspect, revoke
- Refresh via token grant

### Phase 7: Hardening & Forward-Compat
- request passthrough
- Ops registry persistence
- Robust retry/backoff controls
- Compatibility tests for API version drift

## Testing Plan
- Unit tests: client, pagination, retries, path validation, error mapping
- Fixture tests: response shape for each endpoint
- Integration smoke tests (opt-in) using NOTION_TOKEN

## Documentation
- Quickstart: create integration, share resources, set env vars
- Example commands for each group
- Agent usage patterns (stdin JSON, --all, --ndjson, --async)

## Deliverables
- `plan.md` (this document)
- `implementation.md` with step-by-step execution details
- CLI executable and docs
