// The deterministic floor of card L4 over a seeded-fault set (card L2): card
// L1's lints, run by Plane.lint without a lint model over every state of the
// set under its lint-time policy, and the units card L3's lints would send
// (planModelLints), one JSON line per state. No model is called; no label is
// read (research/scripts/h3_lint_floor.py joins them).
//
//   node packages/runner/scripts/lint-fault-set.ts --set <dir> --out <file> [--from <i> --to <j>]
//
// --from and --to take the states at those positions only (half open), so a
// caller can split the set across processes.
import { closeSync, openSync, writeSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  lintFaultStateDeterministic,
  readSetPolicy,
  readSetStates,
} from "../src/lint-fault-set.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      set: { type: "string" },
      out: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
    },
  });
  if (!values.set || !values.out) {
    console.error("usage: lint-fault-set.ts --set <dir> --out <file> [--from <i> --to <j>]");
    return 2;
  }
  const range = {
    ...(values.from === undefined ? {} : { from: Number(values.from) }),
    ...(values.to === undefined ? {} : { to: Number(values.to) }),
  };
  for (const v of Object.values(range))
    if (!Number.isInteger(v) || v < 0) throw new Error("--from and --to are positions, from 0");
  const policy = readSetPolicy(values.set);
  const out = openSync(values.out, "w");
  try {
    for await (const state of readSetStates(values.set, range))
      writeSync(out, `${JSON.stringify(await lintFaultStateDeterministic(state, policy))}\n`);
  } finally {
    closeSync(out);
  }
  return 0;
}

if (process.argv[1]?.endsWith("lint-fault-set.ts")) process.exitCode = await main();
