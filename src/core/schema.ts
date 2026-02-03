import fs from "node:fs/promises";
import path from "node:path";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schemaCache = new Map<string, ValidateFunction>();

export async function validateAgainstSchema(
  schemaPath: string,
  data: unknown
): Promise<{ valid: boolean; errors: string[] } | null> {
  const abs = path.isAbsolute(schemaPath)
    ? schemaPath
    : path.join(process.cwd(), schemaPath);

  let validate = schemaCache.get(abs);
  if (!validate) {
    const raw = await fs.readFile(abs, "utf8");
    const schema = JSON.parse(raw);
    validate = ajv.compile(schema);
    schemaCache.set(abs, validate);
  }

  const valid = validate(data) as boolean;
  if (valid) return { valid: true, errors: [] };

  const errors = (validate.errors || []).map((err: ErrorObject) => {
    const loc = err.instancePath || "(root)";
    return `${loc} ${err.message ?? "invalid"}`.trim();
  });

  return { valid: false, errors };
}
