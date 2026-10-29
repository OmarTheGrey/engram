// Writes packages/runner/src/model/provider-keys.json from the installed pi-ai
// (see ../src/model/provider-keys.ts). Run by `make api`, which formats it
// with Biome afterwards; `make api-check` fails when the committed file differs.
//
//   node packages/runner/scripts/provider-keys.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { providerKeys } from "../src/model/provider-keys.ts";

const out = fileURLToPath(new URL("../src/model/provider-keys.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(providerKeys(), null, 2)}\n`);
process.exitCode = 0;
