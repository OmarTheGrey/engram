// The refusal-leak rows for research/scripts/h1_refusal_leaks.py
// (docs/tasks/prereg-v1-plan.md, PR 4, part A, review fix pass, item 9;
// packages/runner/src/research/refusal-leaks.ts). One row per access-control
// and active-forgetting checkpoint: the plain refusals GateMem's rule-based
// scorer counts as a leak there. No model is called.
//
//   node packages/runner/scripts/refusal-leaks.ts --data <bench/data dir> \
//       --refusals <file.json> --out <file.json>
//
// The data's hashes are checked by the calling script against the pinned
// manifest before this runs. The output holds the rows sorted by checkpoint
// id, and no path or time.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gatemem } from "@engram/bench";
import { type RefusalRow, refusalRows } from "../src/research/refusal-leaks.ts";

function main(): number {
  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      refusals: { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.data || !values.refusals || !values.out) {
    console.error(
      "usage: refusal-leaks.ts --data <bench/data dir> --refusals <file.json> --out <file.json>",
    );
    return 2;
  }
  const refusals = JSON.parse(readFileSync(values.refusals, "utf8")) as unknown;
  if (!Array.isArray(refusals) || !refusals.every((r) => typeof r === "string")) {
    console.error("refusal-leaks: --refusals must name a JSON list of strings");
    return 2;
  }
  const rows: RefusalRow[] = gatemem
    .loadDataset(values.data)
    .flatMap((domain) => refusalRows(domain, refusals));
  rows.sort((a, b) => (a.checkpoint_id < b.checkpoint_id ? -1 : 1));
  writeFileSync(values.out, `${JSON.stringify({ rows })}\n`);
  console.error(`refusal-leaks: ${rows.length} checkpoints, no model called`);
  return 0;
}

process.exitCode = main();
