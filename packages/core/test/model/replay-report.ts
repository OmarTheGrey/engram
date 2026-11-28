// The trace replay's report (card E1.8), for research/scripts/quint_trace_replay.py:
// `node packages/core/test/model/replay-report.ts --traces <dir> --prefix <p> --out <file>`.
// Replays every .itf.json.gz trace under <dir> (replay.ts) and writes, as
// JSON, each trace's outcome and the totals over the random traces (those
// whose name starts with <p>); the scenario traces (the known gaps and the
// findings) are reported apart. No model is called; the clock and the ids
// are injected, so the report is the same bytes on every run.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { readTrace } from "./itf.ts";
import { FINDINGS, outcome, replay } from "./replay.ts";

const arg = (name: string) => {
  const k = process.argv.indexOf(`--${name}`);
  return k < 0 ? undefined : process.argv[k + 1];
};

async function main() {
  const dir = arg("traces");
  const prefix = arg("prefix");
  const out = arg("out");
  if (!dir || !prefix || !out) {
    console.error("usage: replay-report.ts --traces <dir> --prefix <prefix> --out <file>");
    process.exitCode = 2;
    return;
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".itf.json.gz"))
    .sort();
  const digest = createHash("sha256");
  const traces: Record<string, ReturnType<typeof outcome>> = {};
  const scenarios: Record<string, ReturnType<typeof outcome> & { final?: unknown }> = {};
  for (const f of files) {
    const bytes = readFileSync(join(dir, f));
    // Over the decompressed JSON, so a compressor of another zlib version
    // leaves the digest as it is.
    digest.update(f).update("\0").update(gunzipSync(bytes)).update("\0");
    const r = await replay(readTrace(join(dir, f)));
    if (f.startsWith(prefix)) traces[f] = outcome(r);
    else
      scenarios[f] = {
        ...outcome(r),
        final: { proj: r.final.proj, store: r.final.store, marks: r.final.marks },
      };
  }
  const rows = Object.values(traces);
  const byFinding: Record<string, number> = Object.fromEntries(
    [...Object.keys(FINDINGS), "unexplained"].map((f) => [f, 0]),
  );
  for (const r of rows)
    if (r.outcome === "diverged")
      byFinding[r.finding as string] = (byFinding[r.finding as string] ?? 0) + 1;
  const report = {
    traces_sha256: digest.digest("hex"),
    totals: {
      traces: rows.length,
      replayed: rows.filter((r) => r.outcome === "replayed").length,
      diverged: rows.filter((r) => r.outcome === "diverged").length,
      steps: rows.reduce((n, r) => n + r.steps, 0),
      steps_matched: rows.reduce((n, r) => n + r.matched, 0),
      states_compared: rows.reduce((n, r) => n + r.compared, 0),
      steps_folded: rows.reduce((n, r) => n + r.folded, 0),
      diverged_by_finding: byFinding,
    },
    findings: FINDINGS,
    traces,
    scenarios,
  };
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
}

await main();
