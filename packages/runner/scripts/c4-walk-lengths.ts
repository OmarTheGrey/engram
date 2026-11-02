// Development-time measure of C4's read under the walk (PR #25 review round
// 3, V-2): for every GateMem checkpoint, with its own question as the query,
// how many items C4 shows (core's walkToAdmitted down the shared ranking of
// every turn item, with core's evaluateRead under the preset as the verdict)
// against C2's and C5's lists, and how many of C4's are allowed and denied.
// C4's allowed items equal C5's list by construction; the counts confirm it
// on the data. For comparison, `c2_top_allowed` counts the allowed items
// among C2's top READ_LIMIT, which is what C4 showed as allowed in round 2,
// and `c2_top_allowed_strict_subset` the checkpoints where those were fewer
// than C5's list. Counts only; no session runs, no model is called.
//
//   node packages/runner/scripts/c4-walk-lengths.ts <bench/data dir> [preset]
import { gatemem } from "@engram/bench";
import { evaluateRead, loadPreset, type PresetName, retrieve, walkToAdmitted } from "@engram/core";
import { READ_LIMIT } from "../src/conditions.ts";
import { sequentialIds } from "../src/gatemem-probe.ts";

const bucketOf = (n: number) =>
  n === 0
    ? "none"
    : n < 20
      ? "1-19"
      : n === 20
        ? "exactly 20"
        : n <= 40
          ? "21-40"
          : n <= 80
            ? "41-80"
            : n <= 160
              ? "81-160"
              : "161+";

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] as number;
}

function main(): number {
  const [data, preset = "medium"] = process.argv.slice(2);
  if (!data) {
    console.error("usage: c4-walk-lengths.ts <bench/data dir> [preset]");
    return 2;
  }
  const policy = loadPreset(preset as PresetName);
  const lengths: number[] = [];
  const histogram: Record<string, number> = {};
  const byType: Record<string, Record<string, number>> = {};
  let equal = 0;
  for (const d of gatemem.loadDataset(data)) {
    for (const c of d.checkpoints) {
      const e = d.episodes.find((x) => x.episode_id === c.episode_id);
      if (!e) throw new Error(`no episode for ${c.checkpoint_id}`);
      const mapped = gatemem.mapCheckpoint(e, c, sequentialIds());
      const items = mapped.writes.map((w) => w.item);
      const admits = (i: (typeof items)[number]) =>
        evaluateRead(policy, mapped.asker, i, mapped.at).admitted;
      const c4 = walkToAdmitted(items, c.query_text, mapped.at, READ_LIMIT, admits);
      const c5 = retrieve(items.filter(admits), c.query_text, mapped.at, READ_LIMIT);
      const c2 = retrieve(items, c.query_text, mapped.at, READ_LIMIT);
      const allowed = c4.filter((w) => w.admitted);
      if (
        JSON.stringify(allowed.map((w) => w.item.id)) === JSON.stringify(c5.map((r) => r.item.id))
      )
        equal++;
      lengths.push(c4.length);
      const b = bucketOf(c4.length);
      histogram[b] = (histogram[b] ?? 0) + 1;
      byType[c.query_type] ??= {
        checkpoints: 0,
        c2_items: 0,
        c5_items: 0,
        c4_items: 0,
        c4_allowed: 0,
        c4_denied: 0,
        c2_top_allowed: 0,
        c2_top_allowed_strict_subset: 0,
      };
      const row = byType[c.query_type] as Record<string, number>;
      row.checkpoints = (row.checkpoints ?? 0) + 1;
      row.c2_items = (row.c2_items ?? 0) + c2.length;
      row.c5_items = (row.c5_items ?? 0) + c5.length;
      row.c4_items = (row.c4_items ?? 0) + c4.length;
      row.c4_allowed = (row.c4_allowed ?? 0) + allowed.length;
      row.c4_denied = (row.c4_denied ?? 0) + c4.length - allowed.length;
      const c2Allowed = c2.filter((r) => admits(r.item)).length;
      row.c2_top_allowed = (row.c2_top_allowed ?? 0) + c2Allowed;
      if (c2Allowed < c5.length)
        row.c2_top_allowed_strict_subset = (row.c2_top_allowed_strict_subset ?? 0) + 1;
    }
  }
  const sorted = [...lengths].sort((a, b) => a - b);
  const n = sorted.length;
  console.log(
    JSON.stringify(
      {
        preset,
        read_limit: READ_LIMIT,
        checkpoints: n,
        c4_allowed_equals_c5: equal,
        c4_length: {
          min: sorted[0],
          q1: quantile(sorted, 0.25),
          median: quantile(sorted, 0.5),
          q3: quantile(sorted, 0.75),
          max: sorted[n - 1],
          mean: Math.round((sorted.reduce((a, b) => a + b, 0) / n) * 10) / 10,
          over_limit: sorted.filter((x) => x > READ_LIMIT).length,
          histogram: Object.fromEntries(
            ["none", "1-19", "exactly 20", "21-40", "41-80", "81-160", "161+"].map((k) => [
              k,
              histogram[k] ?? 0,
            ]),
          ),
        },
        by_query_type: byType,
      },
      null,
      2,
    ),
  );
  return 0;
}

process.exitCode = main();
