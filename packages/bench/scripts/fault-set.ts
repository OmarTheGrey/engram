// Writes the seeded-fault set (card L2) for a LongMemEval question file:
// every question's memory state, built through the Plane on the fake store,
// with its labelled faults and near-misses (packages/bench/src/faults/).
//
//   node packages/bench/scripts/fault-set.ts --data <file> --seed <n> --per-question <n> --out <dir> [--from <i> --to <j>]
//   node packages/bench/scripts/fault-set.ts --data <file> --config <research config> --out <dir>
//
// --config takes the seed and the count per question from a research config
// (research/configs/h3-fault-set.json's `seed` and `per_question`), which is
// how `make fixtures` writes the fixture-size set from B5's vendored subset.
// <file> is upstream's JSON array (longmemeval_s_cleaned.json at the pin) or
// a vendored questions.jsonl. --from and --to take the questions at those
// positions only (half open), so a caller can split the set across
// processes; each question's faults depend only on the seed and its id.
// Writes, in <dir>:
//   policy.json     the lint-time policy every state is linted under
//   states.jsonl    one state per line: question_id, at, actor, scopes, events
//   labels.jsonl    one label per line, in question order then write order
//   stats.jsonl     one line per question: what its state holds
// Every file is byte-stable for the same input, seed and range. Nothing is
// fetched and no model is called.
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createFakeAdapter } from "@engram/adapters";
import { createPlane, migrate, openSqlite } from "@engram/core";
import { faultState, lintPolicy, type PlaneFactory } from "../src/faults/generate.ts";
import { Question } from "../src/longmemeval/schema.ts";
import { visibleQuestion } from "../src/longmemeval/strip.ts";

export const open: PlaneFactory = (policy, newId) => {
  const db = openSqlite(":memory:");
  migrate(db);
  return {
    plane: createPlane({ db, adapter: createFakeAdapter(), policy, newId }),
    close: () => db.close(),
  };
};

/** Every question of `path`: a JSON array, or JSON Lines when the name ends in .jsonl. */
export function readQuestions(path: string): Question[] {
  const text = readFileSync(path, "utf8");
  const raw: unknown[] = path.endsWith(".jsonl")
    ? text
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => JSON.parse(l))
    : (JSON.parse(text) as unknown[]);
  return raw.map((r, i) => {
    const parsed = Question.safeParse(r);
    if (!parsed.success) throw new Error(`${path}: question ${i}: ${parsed.error.message}`);
    return parsed.data;
  });
}

const line = (value: unknown) => `${JSON.stringify(value)}\n`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      config: { type: "string" },
      seed: { type: "string" },
      "per-question": { type: "string" },
      out: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
    },
  });
  const config = values.config
    ? (JSON.parse(readFileSync(values.config, "utf8")) as { seed: number; per_question: number })
    : undefined;
  const seed = config?.seed ?? values.seed;
  const perQuestion = config?.per_question ?? values["per-question"];
  if (!values.data || seed === undefined || perQuestion === undefined || !values.out) {
    console.error(
      "usage: fault-set.ts --data <file> (--seed <n> --per-question <n> | --config <file>) --out <dir> [--from <i> --to <j>]",
    );
    return 2;
  }
  const opts = { seed: Number(seed), perQuestion: Number(perQuestion) };
  if (!Number.isInteger(opts.seed) || !Number.isInteger(opts.perQuestion) || opts.perQuestion < 1)
    throw new Error("--seed must be an integer and --per-question a positive integer");
  const all = readQuestions(values.data);
  const from = values.from === undefined ? 0 : Number(values.from);
  const to = values.to === undefined ? all.length : Number(values.to);
  const out = values.out;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "policy.json"), `${JSON.stringify(lintPolicy(), null, 2)}\n`);
  const files = {
    states: openSync(join(out, "states.jsonl"), "w"),
    labels: openSync(join(out, "labels.jsonl"), "w"),
    stats: openSync(join(out, "stats.jsonl"), "w"),
  };
  try {
    for (const q of all.slice(from, to)) {
      const { state, labels, stats } = await faultState(visibleQuestion(q), opts, open);
      writeSync(files.states, line(state));
      for (const l of labels) writeSync(files.labels, line(l));
      writeSync(files.stats, line(stats));
    }
  } finally {
    for (const fd of Object.values(files)) closeSync(fd);
  }
  return 0;
}

if (process.argv[1]?.endsWith("fault-set.ts")) process.exitCode = await main();
