// The clock measurement's entry point for research/scripts/h2_longmemeval_ttl.py
// (card B6; packages/runner/src/research/longmemeval-clock.ts): one row per
// question of a LongMemEval data file, under each preset named, as JSON Lines.
// No model is called.
//
//   node packages/runner/scripts/longmemeval-clock.ts --data <questions .json or .jsonl> \
//       --presets medium,strict,permissive --real-time 2026-11-19T00:00:00.000Z --out <rows.jsonl>
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { longMemEval } from "@engram/bench";
import { PRESETS, type PresetName } from "@engram/core";
import { clockRow } from "../src/research/longmemeval-clock.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      presets: { type: "string" },
      "real-time": { type: "string" },
      out: { type: "string" },
    },
  });
  const presets = (values.presets ?? "").split(",").filter(Boolean) as PresetName[];
  const real = values["real-time"];
  if (
    !values.data ||
    !values.out ||
    !real ||
    Number.isNaN(Date.parse(real)) ||
    presets.length === 0 ||
    !presets.every((p) => PRESETS.includes(p))
  ) {
    console.error(
      "usage: longmemeval-clock.ts --data <file> --presets <p1,p2,...> --real-time <ISO instant> --out <rows.jsonl>",
    );
    return 2;
  }
  const rows: string[] = [];
  for (const q of longMemEval.loadQuestions(values.data)) {
    rows.push(`${JSON.stringify(await clockRow(q, presets, real))}\n`);
  }
  writeFileSync(values.out, rows.join(""));
  console.error(`longmemeval-clock: ${rows.length} questions; no model called`);
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
