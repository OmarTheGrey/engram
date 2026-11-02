// C4's evidence rows on GateMem for research/scripts/h1_c4_verdict_agreement.py
// (--rows verdicts) and research/scripts/h1_c4_walk.py (--rows walk)
// (docs/tasks/prereg-v1-plan.md, PR 4, part A, deliverables 2 and 3;
// packages/runner/src/research/c4-evidence.ts). One row per checkpoint, for
// the asker of each, under the preset named. No model is called.
//
//   node packages/runner/scripts/c4-evidence.ts --rows verdicts|walk --data <bench/data dir> \
//       --preset medium [--read-limit 20] --out <file.json>
//
// The data's hashes are checked by the calling script against the pinned
// manifest before this runs. The output holds the preset, the read limit
// and the rows sorted by checkpoint id, and no path or time.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gatemem } from "@engram/bench";
import { loadPreset, PRESETS, type PresetName } from "@engram/core";
import { READ_LIMIT } from "../src/conditions.ts";
import { verdictRow, walkRow } from "../src/research/c4-evidence.ts";

function main(): number {
  const { values } = parseArgs({
    options: {
      rows: { type: "string" },
      data: { type: "string" },
      preset: { type: "string" },
      "read-limit": { type: "string" },
      out: { type: "string" },
    },
  });
  const preset = values.preset as PresetName | undefined;
  const readLimit = values["read-limit"] === undefined ? READ_LIMIT : Number(values["read-limit"]);
  if (
    (values.rows !== "verdicts" && values.rows !== "walk") ||
    !values.data ||
    !values.out ||
    !preset ||
    !PRESETS.includes(preset) ||
    !Number.isInteger(readLimit) ||
    readLimit <= 0
  ) {
    console.error(
      `usage: c4-evidence.ts --rows verdicts|walk --data <bench/data dir> --preset <${PRESETS.join("|")}> [--read-limit <n>] --out <file.json>`,
    );
    return 2;
  }
  const policy = loadPreset(preset);
  const rows: { checkpoint_id: string }[] = [];
  for (const domain of gatemem.loadDataset(values.data)) {
    for (const c of domain.checkpoints) {
      rows.push(
        values.rows === "verdicts"
          ? verdictRow(domain, c, policy)
          : walkRow(domain, c, policy, readLimit),
      );
    }
  }
  rows.sort((a, b) => (a.checkpoint_id < b.checkpoint_id ? -1 : 1));
  writeFileSync(
    values.out,
    `${JSON.stringify({ preset, read_limit: readLimit, rows: values.rows, data: rows })}\n`,
  );
  console.error(
    `c4-evidence: ${rows.length} checkpoints, ${values.rows} rows under ${preset}, no model called`,
  );
  return 0;
}

process.exitCode = main();
