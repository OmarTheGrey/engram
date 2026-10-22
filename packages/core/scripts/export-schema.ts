// Writes sdk/schema/<Contract>.json from packages/core/src/schema.ts. Run by `make api`.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contractJsonSchemas } from "../src/schema.ts";

const out = process.argv[2] ?? "sdk/schema";
mkdirSync(out, { recursive: true });
for (const stale of readdirSync(out).filter((f) => f.endsWith(".json"))) rmSync(join(out, stale));
for (const [file, schema] of Object.entries(contractJsonSchemas())) {
  writeFileSync(join(out, file), `${JSON.stringify(schema, null, 2)}\n`);
}
