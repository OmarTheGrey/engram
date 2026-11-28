// The paired fault-injection check for H3 (card X18, proposal U6): every
// question of a LongMemEval file as a base built as card B5 builds it, with
// its control and its six fault pairs (packages/bench/src/governance-faults/).
//
//   node packages/bench/scripts/governance-faults.ts --data <file> --seed <n> --out <file.jsonl> [--from <i> --to <j>]
//
// <file> is upstream's JSON array (longmemeval_s_cleaned.json at the pin) or
// a vendored questions.jsonl. --from and --to take the questions at those
// positions only (half open), so research/scripts/h3_fault_injection.py can
// split the run across processes; a base depends only on the seed and its
// question. Writes one line per base: ids, counts, verdicts and booleans, no
// LongMemEval text. Byte-stable for the same input, seed and range. Nothing is
// fetched and no model is called.
import { closeSync, openSync, writeSync } from "node:fs";
import { parseArgs } from "node:util";
import { checkBase } from "../src/governance-faults/inject.ts";
import { visibleQuestion } from "../src/longmemeval/strip.ts";
import { readQuestions } from "./fault-set.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      seed: { type: "string" },
      out: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
    },
  });
  if (!values.data || values.seed === undefined || !values.out) {
    console.error(
      "usage: governance-faults.ts --data <file> --seed <n> --out <file.jsonl> [--from <i> --to <j>]",
    );
    return 2;
  }
  const seed = Number(values.seed);
  if (!Number.isInteger(seed)) throw new Error("--seed must be an integer");
  const all = readQuestions(values.data);
  const from = values.from === undefined ? 0 : Number(values.from);
  const to = values.to === undefined ? all.length : Number(values.to);
  const fd = openSync(values.out, "w");
  try {
    for (const q of all.slice(from, to)) {
      const outcome = await checkBase(visibleQuestion(q), { seed });
      writeSync(fd, `${JSON.stringify(outcome)}\n`);
    }
  } finally {
    closeSync(fd);
  }
  return 0;
}

if (process.argv[1]?.endsWith("governance-faults.ts")) process.exitCode = await main();
