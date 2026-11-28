// The paired fault-injection check for H3 (card X18, proposal U6): every
// question of a LongMemEval file as a base built as card B5 builds it, with
// its control and its six fault pairs (packages/bench/src/governance-faults/).
//
//   node packages/bench/scripts/governance-faults.ts --data <file> --seed <n> --out <file.jsonl>
//
// <file> is upstream's JSON array (longmemeval_s_cleaned.json at the pin) or
// a vendored questions.jsonl; research/scripts/h3_fault_injection.py splits
// the run across processes by writing one such file per process, and a base
// depends only on the seed and its question. Writes one line per base: ids, counts, verdicts and booleans, no
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
    },
  });
  if (!values.data || values.seed === undefined || !values.out) {
    console.error("usage: governance-faults.ts --data <file> --seed <n> --out <file.jsonl>");
    return 2;
  }
  const seed = Number(values.seed);
  if (!Number.isInteger(seed)) throw new Error("--seed must be an integer");
  const fd = openSync(values.out, "w");
  try {
    for (const q of readQuestions(values.data)) {
      const outcome = await checkBase(visibleQuestion(q), { seed });
      writeSync(fd, `${JSON.stringify(outcome)}\n`);
    }
  } finally {
    closeSync(fd);
  }
  return 0;
}

if (process.argv[1]?.endsWith("governance-faults.ts")) process.exitCode = await main();
