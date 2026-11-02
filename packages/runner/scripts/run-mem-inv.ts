// `make run CONFIG=<a mem-inv-bench config>` (card B4, card X1): run.ts runs
// a config whose benchmark is mem-inv-bench through runMemInvConfig and
// prints these lines. Each (case, store, condition, seed) is a pi SDK
// session; every model call goes through the config's cassettes, and without
// --record (or --live) a miss is an error (finding R7-11).
import { configStores } from "../src/config.ts";
import {
  type MemInvRunnerConfig,
  type MemInvRunnerResult,
  readMemInvConfig,
  runMemInvConfig,
  writeMemInvResult,
} from "../src/mem-inv-probe.ts";

/** What run.ts prints for a MEM-INV-Bench run: every session's verdict and the plane's part in it. */
export function memInvLines(
  config: MemInvRunnerConfig,
  result: MemInvRunnerResult,
  out: string,
  how = "",
  live = false,
): string[] {
  const items = config.items === "all" ? "all" : `${config.items.length}`;
  return [
    `${config.name}: ${result.rows.length} sessions (${items} cases x ${config.conditions.join(", ")} x stores ${configStores(config).join(", ")} x seeds ${config.seeds.join(", ")}), model ${config.model}, preset ${config.preset}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${how}`,
    ...result.rows.flatMap((r) => [
      `  ${r.condition} ${r.store} seed ${r.seed} ${r.case_id}: verdict ${r.outcome.verdict} (bucket ${r.outcome.bucket}), attack success ${r.outcome.attack_success}, ${r.stored} stored, ${r.decisions.length} session plane decisions`,
      ...r.writes.map(
        (w) =>
          `    write ${w.entry_id} ${w.channel} as ${w.actor} (${w.kind}) into ${w.scope}: ${w.decision}${w.policy_id ? ` ${w.policy_id}` : ""}`,
      ),
      ...r.decisions
        .filter((d) => d.op === "read")
        .map((d) => `    action-time read: ${d.decision} ${d.policy_id}: ${d.reason}`),
    ]),
    live
      ? "live run on a named model; a pipeline config's numbers are still not results"
      : "pipeline config: scripted model, rule-based scorer only; these are not results. Each verdict is the scripted reply's and says nothing about the plane; the plane's part is the write and read decisions above",
    `written to ${out}`,
  ];
}

/** Card B4's entry point, kept for callers: replay (or record) one config and print its lines. */
export async function runMemInvMain(path: string, out: string, record: boolean): Promise<number> {
  if (record && process.env.ENGRAM_OFFLINE === "1") {
    console.error("run.ts: --record with ENGRAM_OFFLINE=1 would record nothing; drop one");
    return 2;
  }
  const config = readMemInvConfig(path);
  const result = await runMemInvConfig(config, { offline: !record });
  writeMemInvResult(result, out);
  console.log(memInvLines(config, result, out).join("\n"));
  return 0;
}
