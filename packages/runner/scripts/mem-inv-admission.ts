// MEM-INV-Bench admission rows for research/scripts/h1_mem_inv_admission.py
// (docs/tasks/prereg-v1-plan.md, PR 2, item 3). For each vendored case and
// each preset named, the plane's write decision on every entry and whether
// the operator's action-time read returned it, with the entries that carry
// the attack (or the legitimate value) marked
// (packages/runner/src/research/mem-inv-admission.ts). No model is called.
//
//   node packages/runner/scripts/mem-inv-admission.ts --fixtures fixtures/bench/mem-inv-bench \
//       --presets strict,medium,permissive --out <file.json>
//
// The fixture's line hashes are checked by the calling script against its
// manifest before this runs. Rows are sorted by preset, then case id; the
// output holds no path or time.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { memInvBench } from "@engram/bench";
import { PRESETS, type PresetName } from "@engram/core";
import {
  type AdmissionRow,
  admissionOf,
  labelAdmission,
} from "../src/research/mem-inv-admission.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      fixtures: { type: "string" },
      presets: { type: "string" },
      out: { type: "string" },
    },
  });
  const presets = (values.presets ?? "").split(",").filter(Boolean) as PresetName[];
  if (
    !values.fixtures ||
    !values.out ||
    presets.length === 0 ||
    presets.some((p) => !PRESETS.includes(p))
  ) {
    console.error(
      `usage: mem-inv-admission.ts --fixtures <dir> --presets <${PRESETS.join(",")}> --out <file.json>`,
    );
    return 2;
  }
  const cases = memInvBench.loadCases(values.fixtures);
  const rows: AdmissionRow[] = [];
  for (const preset of [...presets].sort()) {
    for (const c of cases) rows.push(labelAdmission(c, await admissionOf(c, preset)));
  }
  rows.sort((a, b) =>
    a.preset === b.preset ? (a.case_id < b.case_id ? -1 : 1) : a.preset < b.preset ? -1 : 1,
  );
  writeFileSync(values.out, `${JSON.stringify({ presets: [...presets].sort(), rows })}\n`);
  console.error(
    `mem-inv-admission: ${cases.length} cases under ${presets.join(", ")}, no model called`,
  );
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
