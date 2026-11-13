// Acceptance for step-0 task S0.7: every fixture under fixtures/schema/ is
// accepted or rejected identically by the Zod schema and by the generated JSON
// Schema in sdk/schema/, and both agree with the fixture's folder (valid or
// invalid).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, test } from "vitest";
import { CONTRACTS, SCHEMA_VERSION, SHARED } from "../../src/schema.ts";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SDK = join(ROOT, "sdk", "schema");
const FIXTURES = join(ROOT, "fixtures", "schema");

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
for (const file of readdirSync(SDK).filter((f) => f.endsWith(".json"))) {
  ajv.addSchema(JSON.parse(readFileSync(join(SDK, file), "utf8")));
}

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const list = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json"));

test("sdk/schema holds exactly one generated file per contract and shared definition", () => {
  expect(list(SDK).sort()).toEqual(
    [...Object.keys(CONTRACTS), ...Object.keys(SHARED)].map((n) => `${n}.json`).sort(),
  );
});

test("the schema version is 1", () => {
  expect(SCHEMA_VERSION).toBe(1);
});

describe.each(Object.keys(CONTRACTS))("%s", (name) => {
  const zod = CONTRACTS[name as keyof typeof CONTRACTS];
  const validate = ajv.getSchema(`${name}.json`);

  test.each(list(join(FIXTURES, name, "valid")))("accepts valid/%s in Zod and JSON Schema", (f) => {
    const value = read(join(FIXTURES, name, "valid", f));
    expect(zod.safeParse(value).error).toBeUndefined();
    expect(validate?.(value), JSON.stringify(validate?.errors)).toBe(true);
  });

  test.each(list(join(FIXTURES, name, "invalid")))(
    "rejects invalid/%s in Zod and JSON Schema",
    (f) => {
      const value = read(join(FIXTURES, name, "invalid", f));
      expect(zod.safeParse(value).success).toBe(false);
      expect(validate?.(value)).toBe(false);
    },
  );
});
