// The GateMem reachable-leak rows for research/scripts/h1_gatemem_reach.py
// (docs/tasks/prereg-v1-plan.md, PR 2, item 2). For every access-control and
// active-forgetting checkpoint of GateMem's data, which turns the asker can
// read under ADR 0030's mapping and the preset, and which leak targets sit in
// them (packages/runner/src/research/gatemem-reach.ts). No model is called.
//
//   node packages/runner/scripts/gatemem-reach.ts --data <bench/data dir> --preset medium \
//       --refusals <file.json> --out <file.json>
//
// --refusals names a JSON list of plain refusals; each row counts how many of
// them GateMem's scorer would score as a leak at that checkpoint.
// The data's hashes are checked by the calling script against the pinned
// manifest before this runs. The output holds the preset and one row per
// checkpoint, sorted by checkpoint id, and no path or time.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gatemem } from "@engram/bench";
import { loadPreset, PRESETS, type PresetName } from "@engram/core";
import { type ReachRow, reachRows } from "../src/research/gatemem-reach.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      preset: { type: "string" },
      refusals: { type: "string" },
      out: { type: "string" },
    },
  });
  const preset = values.preset as PresetName | undefined;
  if (!values.data || !values.out || !values.refusals || !preset || !PRESETS.includes(preset)) {
    console.error(
      `usage: gatemem-reach.ts --data <bench/data dir> --preset <${PRESETS.join("|")}> --refusals <file.json> --out <file.json>`,
    );
    return 2;
  }
  const refusals = JSON.parse(readFileSync(values.refusals, "utf8")) as unknown;
  if (!Array.isArray(refusals) || !refusals.every((r) => typeof r === "string")) {
    console.error("gatemem-reach: --refusals must name a JSON list of strings");
    return 2;
  }
  const policy = loadPreset(preset);
  const rows: ReachRow[] = [];
  for (const domain of gatemem.loadDataset(values.data)) {
    rows.push(...(await reachRows(domain, policy, refusals)));
    console.error(`gatemem-reach: ${domain.domain} done under ${preset}`);
  }
  rows.sort((a, b) => (a.checkpoint_id < b.checkpoint_id ? -1 : 1));
  writeFileSync(values.out, `${JSON.stringify({ preset, rows })}\n`);
  console.error(`gatemem-reach: ${rows.length} checkpoints under ${preset}, no model called`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
