// The pre-tag live checks (card RV6, RV-DES-9; src/research/check-runs.ts).
// No model is called.
//
//   node packages/runner/scripts/check-runs.ts b1-items --data .engram/upstream/gatemem/bench/data [--domain medical] [--per-kind 50]
//       B1's reference subset: the ids research/configs/b1-gatemem-reference.json lists.
//   node packages/runner/scripts/check-runs.ts c1-chars --config <GateMem runner config> --out <file.json>
//       C1's prompt characters per item of the config, for research/scripts/h1_check_runs_cost.py.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gatemem } from "@engram/bench";
import { configItems, readRunnerConfig } from "../src/config.ts";
import { b1ReferenceItems, c1PromptChars } from "../src/research/check-runs.ts";
import { gatememItems } from "../src/run.ts";

const USAGE =
  "usage: check-runs.ts b1-items --data <GateMem data> [--domain medical] [--per-kind 50] | c1-chars --config <runner config> --out <file.json>";

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      data: { type: "string" },
      domain: { type: "string", default: "medical" },
      "per-kind": { type: "string", default: "50" },
      config: { type: "string" },
      out: { type: "string" },
    },
  });
  const [command] = positionals;
  if (command === "b1-items" && values.data) {
    const perKind = Number(values["per-kind"]);
    if (!Number.isInteger(perKind) || perKind < 1) {
      console.error(USAGE);
      return 2;
    }
    const subset = b1ReferenceItems(
      gatemem.loadDataset(values.data),
      values.domain as string,
      perKind,
    );
    console.log(JSON.stringify(subset, null, 2));
    return 0;
  }
  if (command === "c1-chars" && values.config && values.out) {
    const config = readRunnerConfig(values.config);
    const domains = gatemem.loadDataset(config.data);
    const items = configItems(config, gatememItems(domains));
    writeFileSync(values.out, `${JSON.stringify(c1PromptChars(domains, items))}\n`);
    console.error(`check-runs: C1 prompts of ${items.length} items of ${config.name}`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

process.exitCode = main();
