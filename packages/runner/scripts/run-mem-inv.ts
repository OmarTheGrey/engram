// `make run CONFIG=<a mem-inv-bench config>` (card B4, card X1): run.ts runs
// a config whose benchmark is mem-inv-bench through runMemInvConfig and
// prints these lines. Each (case, store, condition, seed) is a pi SDK
// session; every model call goes through the config's cassettes, and without
// --record (or --live) a miss is an error (finding R7-11). Card B4's own
// entry point (runMemInvMain) had no caller and no experiment guard and is
// gone (PR #25 review, P3-9): run.ts is the one way in.
import { type AnyRunnerConfig, configStores } from "../src/config.ts";
import type { MemInvRunnerConfig, MemInvRunnerResult } from "../src/mem-inv-probe.ts";

/**
 * The last line before `written to`: what the run's numbers are, by the
 * config's kind and whether it ran on a named model (P3-10).
 */
export function runFooter(kind: AnyRunnerConfig["kind"], named: boolean, scored: string): string {
  if (kind === "experiment") {
    return `experiment run on a named model; its rows are the pre-registered analysis's input (${scored}); no number here is a result until research/scripts produces it`;
  }
  return named
    ? `pipeline config on a named model (${scored}); a pipeline config's numbers are not results`
    : `pipeline config: scripted model (${scored}); these are not results`;
}

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
    runFooter(
      config.kind,
      live,
      "scored with upstream's rule bucketer; a scripted verdict says nothing about the plane, whose part is the write and read decisions above",
    ),
    `written to ${out}`,
  ];
}
