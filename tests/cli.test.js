import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const ENTRY = path.join(ROOT, "src", "index.ts");

function runCli(args, { env = {}, input = "" } = {}) {
  return new Promise((resolve) => {
    const child = spawn("node", ["--import", "tsx", ENTRY, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  assert.ok(trimmed, "stdout should not be empty");
  return JSON.parse(trimmed);
}

function assertErrorEnvelope(output, code) {
  assert.equal(output.status, "error");
  assert.equal(output.error?.code, code);
  assert.ok(output.metadata?.command);
}

test("oauth token missing grant type returns INVALID_ARGUMENT", async () => {
  const result = await runCli(["oauth", "token", "--client-id", "x", "--client-secret", "y"]);
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "INVALID_ARGUMENT");
});

test("users list without token returns AUTH_FAILED", async () => {
  const result = await runCli(["users", "list"]);
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 10);
  assertErrorEnvelope(out, "AUTH_FAILED");
});

test("search with --token-stdin and stdin JSON conflict returns INVALID_ARGUMENT", async () => {
  const result = await runCli(["search", "--token-stdin", "--filter", "-"], { input: "token" });
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "INVALID_ARGUMENT");
});

test("pages get missing id returns MISSING_ARGUMENT", async () => {
  const result = await runCli(["pages", "get"], { env: { NOTION_TOKEN: "dummy" } });
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "MISSING_ARGUMENT");
});

test("blocks get missing id returns MISSING_ARGUMENT", async () => {
  const result = await runCli(["blocks", "get"], { env: { NOTION_TOKEN: "dummy" } });
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "MISSING_ARGUMENT");
});

test("databases create dry-run exits 40", async () => {
  const result = await runCli([
    "databases",
    "create",
    "--parent",
    "{}",
    "--title",
    "[]",
    "--properties",
    "{}",
    "--dry-run"
  ], { env: { NOTION_TOKEN: "dummy" } });
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 40);
  assert.equal(out.status, "success");
  assert.equal(out.data?.dry_run, true);
});

test("data-sources query missing id returns MISSING_ARGUMENT", async () => {
  const result = await runCli(["data-sources", "query"], { env: { NOTION_TOKEN: "dummy" } });
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "MISSING_ARGUMENT");
});

test("comments create dry-run exits 40", async () => {
  const result = await runCli([
    "comments",
    "create",
    "--rich-text",
    "[]",
    "--dry-run"
  ], { env: { NOTION_TOKEN: "dummy" } });
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 40);
  assert.equal(out.status, "success");
  assert.equal(out.data?.dry_run, true);
});

test("file-uploads create missing args returns INVALID_ARGUMENT", async () => {
  const result = await runCli(["file-uploads", "create"]);
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "INVALID_ARGUMENT");
});

test("ops get missing id returns MISSING_ARGUMENT", async () => {
  const result = await runCli(["ops", "get"]);
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "MISSING_ARGUMENT");
});

test("request missing required args returns INVALID_ARGUMENT", async () => {
  const result = await runCli(["request", "--method", "GET"]);
  const out = parseJsonOutput(result.stdout);
  assert.equal(result.code, 2);
  assertErrorEnvelope(out, "INVALID_ARGUMENT");
});
