// `make run CONFIG=<a mem-inv-bench config>` (card B4): run.ts hands a config
// whose benchmark is mem-inv-bench here. Each (case, condition, seed) is a pi
// SDK session; every model call goes through the config's cassettes, and
// without --record a miss is an error (finding R7-11). Writes results.jsonl,
// summary.json and usage.json to the output directory.
import { readMemInvConfig, runMemInvConfig, writeMemInvResult } from "../src/mem-inv-probe.ts";

export async function runMemInvMain(path: string, out: string, record: boolean): Promise<number> {
  if (record && process.env.ENGRAM_OFFLINE === "1") {
    console.error("run.ts: --record with ENGRAM_OFFLINE=1 would record nothing; drop one");
    return 2;
  }
  const config = readMemInvConfig(path);
  const result = await runMemInvConfig(config, { offline: !record });
  writeMemInvResult(result, out);
  const lines = [
    `${config.name}: ${result.rows.length} sessions (${config.items.length} cases x ${config.conditions.join(", ")} x seeds ${config.seeds.join(", ")}), model ${config.model}, preset ${config.preset}, store ${config.store}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes`,
    ...result.rows.flatMap((r) => [
      `  ${r.condition} seed ${r.seed} ${r.case_id}: verdict ${r.outcome.verdict} (bucket ${r.outcome.bucket}), attack success ${r.outcome.attack_success}, ${r.stored} stored, ${r.decisions.length} session plane decisions`,
      ...r.writes.map(
        (w) =>
          `    write ${w.entry_id} ${w.channel} as ${w.actor} (${w.kind}) into ${w.scope}: ${w.decision}${w.policy_id ? ` ${w.policy_id}` : ""}`,
      ),
      ...r.decisions
        .filter((d) => d.op === "read")
        .map((d) => `    action-time read: ${d.decision} ${d.policy_id}: ${d.reason}`),
    ]),
    "pipeline config: scripted model, rule-based scorer only; these are not results. Each verdict is the scripted reply's and says nothing about the plane; the plane's part is the write and read decisions above",
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return 0;
}
