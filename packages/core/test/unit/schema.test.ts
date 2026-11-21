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
import {
  CONTRACTS,
  ContentGuards,
  GuardMode,
  InjectionScreen,
  SCHEMA_VERSION,
  SHARED,
  Trust,
  TrustSwitch,
} from "../../src/schema.ts";

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

// Card E2.8: the option names and values of ADRs 0039 and 0040 and card E2.8,
// pinned, so a renamed or added value is a deliberate schema change.
test("the content_guards and trust options and their values are exactly the registered ones", () => {
  expect(GuardMode.options).toEqual(["off", "review", "block"]);
  expect(InjectionScreen.options).toEqual(["off", "default", "hardened"]);
  expect(TrustSwitch.options).toEqual(["off", "on"]);
  expect(Object.keys(ContentGuards.shape)).toEqual([
    "secrets",
    "pii",
    "injection_screen",
    "max_content_bytes",
  ]);
  expect(Object.keys(Trust.shape)).toEqual(["unattested_floor", "protect_trusted"]);
  const guards = ContentGuards.shape;
  expect(guards.secrets.unwrap()).toBe(GuardMode);
  expect(guards.pii.unwrap()).toBe(GuardMode);
  expect(guards.injection_screen.unwrap()).toBe(InjectionScreen);
  expect(Trust.shape.unattested_floor.unwrap()).toBe(TrustSwitch);
  expect(Trust.shape.protect_trusted.unwrap()).toBe(TrustSwitch);
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
