# Notion CLI (Agent-Optimized) - Implementation Tasks (Granular Tickets)

## Phase 0: Project Setup
- T0.1 Choose runtime and CLI framework (Node/TS + commander)
- T0.2 Create repo structure (commands/, core/, io/, ops/, tests/, schemas/)
- T0.3 Define config schema (env + config file + CLI override precedence)
- T0.4 Define output envelope schema and metadata fields
- T0.5 Define exit codes per guide and document in help
- T0.6 Define command syntax (prefer flags; allow one positional ID)
- T0.7 Define input JSON schemas per endpoint and place in `schemas/`
- T0.8 Define error code registry and document in help
- T0.9 Add CI skeleton (lint, test) and basic scripts

## Phase 1: Core Plumbing
- T1.1 Implement HTTP client wrapper (base URL, headers, version)
- T1.2 Implement auth header handling (Bearer + Basic for oauth token)
- T1.3 Implement timeout and retry config parsing
- T1.4 Implement request/response logging hooks (stderr only)
- T1.5 Implement error parsing and error envelope
- T1.6 Map errors to stable error.code enums and exit codes
- T1.7 Implement JSON input loader (file, stdin, inline)
- T1.8 Implement output formatter (JSON envelope)
- T1.9 Implement NDJSON writer for streaming lists
- T1.10 Implement output file support
- T1.11 Implement path traversal validation
- T1.12 Implement --help and --help-json generator

## Phase 2: Pagination Engine
- T2.1 Implement cursor iterator utility
- T2.2 Implement --all auto-pagination for list/query endpoints
- T2.3 Implement --page-size and --start-cursor handling
- T2.4 Implement streaming mode for --all + --ndjson

## Phase 3: Read-Only Commands
- T3.1 users list
- T3.2 users get
- T3.3 users me
- T3.4 search
- T3.5 pages get
- T3.6 pages get-property
- T3.7 blocks get
- T3.8 blocks list-children
- T3.9 data-sources get
- T3.10 data-sources query

## Phase 4: Write Commands
- T4.1 pages create
- T4.2 pages update
- T4.3 pages move
- T4.4 blocks append-children
- T4.5 blocks update
- T4.6 blocks delete
- T4.7 comments create
- T4.8 dry-run flag for write commands (exit 40 if changes)
- T4.9 idempotency key support for non-idempotent mutations

## Phase 5: Databases & Data Sources
- T5.1 databases get
- T5.2 databases create
- T5.3 databases update
- T5.4 data-sources create
- T5.5 data-sources update
- T5.6 data-sources list-templates

## Phase 6: File Uploads
- T6.1 file-uploads create
- T6.2 file-uploads send (multipart/form-data)
- T6.3 file-uploads complete
- T6.4 file-uploads get
- T6.5 file-uploads list
- T6.6 implement 5 MB chunking default + configurable overrides

## Phase 7: OAuth
- T7.1 oauth token (auth code grant)
- T7.2 oauth token (refresh grant)
- T7.3 oauth introspect
- T7.4 oauth revoke

## Phase 8: Async Ops Model
- T8.1 Define operation receipt schema
- T8.2 Implement ops registry (file-based) and retention policy
- T8.3 ops get command
- T8.4 ops wait command
- T8.5 --async flag handling for file uploads
- T8.6 --async flag handling for large --all queries

## Phase 9: Forward-Compat
- T9.1 request passthrough command

## Phase 10: Hardening & Tests
- T10.1 Retry/backoff for 429 and 5xx
- T10.2 Unit tests for HTTP client
- T10.3 Unit tests for pagination
- T10.4 Unit tests for error mapping
- T10.5 Fixture tests for response shapes
- T10.6 Integration smoke tests (opt-in)

## Phase 11: Docs & Examples
- T11.1 Quickstart doc (integration setup, sharing resources)
- T11.2 Command reference for each group
- T11.3 Agent-oriented examples (stdin JSON, --all, --ndjson, --async)
- T11.4 Document exit codes, error codes, and envelope schema
