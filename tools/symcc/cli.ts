// The command line of tools/symcc/properties.ts (card E2.18), which
// research/scripts/h2_cedar_properties.py runs:
//   node tools/symcc/cli.ts job --config <config> --out <job.json>
//   node tools/symcc/cli.ts replay --job <job.json> --answers <answers.json> --out <replay.json>
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PRESETS } from "../../packages/core/src/policy/load.ts";
import {
  ACTIONS,
  type Answer,
  buildJob,
  INVARIANTS,
  type Job,
  type PropertySpec,
  replay,
} from "./properties.ts";

/** The config's properties, refused when one names a preset, action or invariant there is not. */
export function parseProperties(config: { properties?: unknown }): PropertySpec[] {
  const props = config.properties;
  if (!Array.isArray(props) || props.length === 0) throw new Error("the config names no properties");
  for (const p of props as PropertySpec[]) {
    for (const name of [...(p.pairs ?? []).flat(), ...(p.presets ?? [])])
      if (!(PRESETS as readonly string[]).includes(name))
        throw new Error(`${p.id}: ${name} is not a registered preset`);
    for (const a of p.actions ?? [])
      if (!(ACTIONS as readonly string[]).includes(a)) throw new Error(`${p.id}: no action ${a}`);
    if (p.shape === "invariant" && !(p.id in INVARIANTS))
      throw new Error(`${p.id}: no such invariant`);
    if (p.expect !== "holds" && p.expect !== "fails")
      throw new Error(`${p.id}: expect is holds or fails`);
  }
  return props as PropertySpec[];
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      config: { type: "string" },
      job: { type: "string" },
      answers: { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.out) throw new Error("--out is required");
  if (command === "job") {
    if (!values.config) throw new Error("job needs --config");
    const config = JSON.parse(readFileSync(values.config, "utf8"));
    const job = await buildJob(parseProperties(config));
    writeFileSync(values.out, `${JSON.stringify(job, null, 2)}\n`);
  } else if (command === "replay") {
    if (!values.job || !values.answers) throw new Error("replay needs --job and --answers");
    const job = JSON.parse(readFileSync(values.job, "utf8")) as Job;
    const answers = (JSON.parse(readFileSync(values.answers, "utf8")) as { checks: Answer[] })
      .checks;
    writeFileSync(values.out, `${JSON.stringify(replay(job, answers), null, 2)}\n`);
  } else throw new Error(`unknown command ${command}: job or replay`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/symcc/cli.ts"))
  main(process.argv.slice(2)).catch((e) => {
    console.error(`properties: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
