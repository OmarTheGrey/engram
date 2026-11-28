// The erasure-residue check (card X19, proposal U7) on one log backend and
// one store (packages/bench/src/residue/):
//
//   node packages/bench/scripts/erasure-residue.ts --backend <sqlite|postgres> \
//     --store <files|mem0|letta|mcp-memory> --seed <n> --cassettes <dir> --out <file.json> //     [--record] [--work <empty dir>]
//
// --work names the folder the log and the store are made in, which the caller
// removes after this process exits (Mem0 keeps its files open until then).
//
// Replays the scripted summaries from the committed cassettes in <dir>, a
// miss an error; --record writes them from the scripted model instead (`make
// fixtures` does, nothing else). Writes one JSON object: per canary, the tiers
// it was found in and as what, and the deletion reports' counts. Synthetic
// canaries only, byte-stable for the same arguments. Nothing is fetched and no
// model is called. research/scripts/h3_erasure_residue.py runs it for every
// backend and store and reduces it to rates.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  BACKENDS,
  type BackendName,
  runResidueCheck,
  STORES,
  type StoreName,
} from "../src/residue/check.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      backend: { type: "string" },
      store: { type: "string" },
      seed: { type: "string" },
      cassettes: { type: "string" },
      out: { type: "string" },
      record: { type: "boolean", default: false },
      work: { type: "string" },
    },
  });
  const usage =
    "usage: erasure-residue.ts --backend <sqlite|postgres> --store <files|mem0|letta|mcp-memory> --seed <n> --cassettes <dir> --out <file.json> [--record] [--work <empty dir>]";
  const backend = values.backend as BackendName;
  const store = values.store as StoreName;
  const seed = Number(values.seed);
  if (
    !BACKENDS.includes(backend) ||
    !STORES.includes(store) ||
    !Number.isInteger(seed) ||
    !values.cassettes ||
    !values.out
  ) {
    console.error(usage);
    return 2;
  }
  const outcome = await runResidueCheck({
    backend,
    store,
    seed,
    cassettes: values.cassettes,
    record: values.record,
    ...(values.work === undefined ? {} : { work: values.work }),
  });
  writeFileSync(values.out, `${JSON.stringify(outcome, null, 2)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith("erasure-residue.ts")) process.exitCode = await main();
