// Development-time measure of the shared retrieval pipeline on GateMem (PR #25
// review round 2, R1): for every checkpoint, with its own question as the
// query, whether C2 (the pipeline over every turn item up to the checkpoint)
// returns anything, whether the history holds the question's leak target
// (access control, forgetting) or answer (utility, the judge's include
// patterns), and whether C2's and C5's top READ_LIMIT hold such a turn. C5's
// list is the pipeline over the items the plane admits for the asker under
// the given preset (core's evaluateRead). Counts only; hidden labels are read
// here to count, never shown to a session.
//
//   node packages/runner/scripts/retrieval-floor.ts <bench/data dir> [preset]
import { gatemem } from "@engram/bench";
import { evaluateRead, loadPreset, type PresetName, retrieve } from "@engram/core";
import { READ_LIMIT } from "../src/conditions.ts";
import { sequentialIds } from "../src/gatemem-probe.ts";

function main(): number {
  const [data, preset = "medium"] = process.argv.slice(2);
  if (!data) {
    console.error("usage: retrieval-floor.ts <bench/data dir> [preset]");
    return 2;
  }
  const policy = loadPreset(preset as PresetName);
  const out: Record<string, Record<string, number>> = {};
  for (const d of gatemem.loadDataset(data)) {
    for (const c of d.checkpoints) {
      const e = d.episodes.find((x) => x.episode_id === c.episode_id);
      if (!e) throw new Error(`no episode for ${c.checkpoint_id}`);
      const mapped = gatemem.mapCheckpoint(e, c, sequentialIds());
      const items = mapped.writes.map((w) => w.item);
      const admitted = items.filter(
        (i) => evaluateRead(policy, mapped.asker, i, mapped.at).admitted,
      );
      const patterns =
        c.query_type === "utility" ? (c.judge_spec.include ?? []) : (c.leak_targets ?? []);
      const holds = (i: (typeof items)[number]) =>
        patterns.some((p) => gatemem.patternHits(String(i.content), p));
      const c2 = retrieve(items, c.query_text, mapped.at, READ_LIMIT).map((r) => r.item);
      const c5 = retrieve(admitted, c.query_text, mapped.at, READ_LIMIT).map((r) => r.item);
      out[c.query_type] ??= Object.fromEntries(
        [
          "checkpoints",
          "c2_returns_any",
          "history_holds_target",
          "c2_top_holds_target",
          "c5_returns_any",
          "c5_top_holds_target",
          "admitted_holds_target",
        ].map((k) => [k, 0]),
      );
      const row = out[c.query_type] as Record<string, number>;
      const add = (k: string, yes: boolean) => {
        if (yes) row[k] = (row[k] ?? 0) + 1;
      };
      add("checkpoints", true);
      add("c2_returns_any", c2.length > 0);
      add("history_holds_target", items.some(holds));
      add("c2_top_holds_target", c2.some(holds));
      add("c5_returns_any", c5.length > 0);
      add("c5_top_holds_target", c5.some(holds));
      add("admitted_holds_target", admitted.some(holds));
    }
  }
  console.log(JSON.stringify({ preset, read_limit: READ_LIMIT, by_query_type: out }, null, 2));
  return 0;
}

process.exitCode = main();
