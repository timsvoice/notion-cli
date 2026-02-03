# Schemas

JSON schemas are used to validate inputs before sending requests to Notion.

## Usage
- Commands accept JSON via file path (e.g. `@payload.json`) or stdin (`-`).
- Validation is on by default; bypass with `--no-validate`.

## Available Schemas
- pages-create.schema.json
- pages-update.schema.json
- blocks-append.schema.json
- blocks-update.schema.json
- data-sources-query.schema.json
- data-sources-create.schema.json
- data-sources-update.schema.json
- databases-create.schema.json
- databases-update.schema.json
- comments-create.schema.json
- file-uploads-create.schema.json
- file-uploads-complete.schema.json
- search.schema.json
- oauth-token.schema.json
- oauth-introspect.schema.json
- oauth-revoke.schema.json
- ops-receipt.schema.json

## Notes
- Schemas are intentionally permissive to avoid blocking API evolution.
- Tighten schemas as endpoints stabilize.
