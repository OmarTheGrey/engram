// Writes card D1's fifty synthetic pi sessions and their index from a seed
// (packages/runner/src/session-fixtures.ts). Only `make fixtures` runs it:
//
//   node packages/runner/scripts/session-fixtures.ts --seed 1 --out fixtures/sessions/d1
//
// It writes into an empty or missing folder only, so a stale file never
// survives a regeneration; `make fixtures` removes the folder first.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { sessionFixtureIndex, sessionFixtures } from "../src/session-fixtures.ts";

const { values } = parseArgs({
  options: { seed: { type: "string" }, out: { type: "string" } },
});
const seed = Number(values.seed);
if (!values.out || !Number.isInteger(seed)) {
  console.error("usage: session-fixtures.ts --seed <integer> --out <folder>");
  process.exitCode = 2;
} else if (existsSync(values.out) && readdirSync(values.out).length > 0) {
  console.error(`session-fixtures: ${values.out} is not empty; remove it first`);
  process.exitCode = 2;
} else {
  const set = sessionFixtures(seed);
  mkdirSync(values.out, { recursive: true });
  for (const [name, text] of Object.entries(set.files)) writeFileSync(join(values.out, name), text);
  writeFileSync(join(values.out, "index.json"), sessionFixtureIndex(set));
  console.log(`session-fixtures: ${Object.keys(set.files).length} sessions in ${values.out}`);
}
