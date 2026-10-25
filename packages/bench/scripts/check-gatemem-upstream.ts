// One-off port check on the full GateMem dataset (card B1), development time
// only: loads all 91 episodes and 2,218 checkpoints at a983828 with the strict
// loader, scores the same synthetic answers as upstream-full-scores.py with
// the port's scorer, and counts disagreements with upstream's scores.
//
//   python -I packages/bench/scripts/upstream-full-scores.py <upstream> <scores.json>
//   node packages/bench/scripts/check-gatemem-upstream.ts <upstream> <scores.json>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { loadDataset } from "../src/gatemem/load.ts";
import { scoreOne } from "../src/gatemem/score.ts";

function main(): number {
  const [upstream, scoresPath] = process.argv.slice(2);
  if (!upstream || !scoresPath) {
    console.error("usage: check-gatemem-upstream.ts <upstream dir> <scores.json>");
    return 2;
  }
  const domains = loadDataset(join(upstream, "bench", "data"));
  const theirs = JSON.parse(readFileSync(scoresPath, "utf8")) as Record<string, unknown[]>;
  let checked = 0;
  let mismatches = 0;
  for (const d of domains) {
    for (const c of d.checkpoints) {
      const e = d.episodes.find((x) => x.episode_id === c.episode_id);
      if (!e) throw new Error(`no episode for ${c.checkpoint_id}`);
      const pos = e.turns.findIndex((t) => t.turn_id === c.as_of_turn_id);
      const text = (ts: typeof e.turns) => ({
        action: "answer",
        answer: ts.map((t) => t.text).join("\n"),
        answer_structured: {},
      });
      const mine = [scoreOne(c, text(e.turns.slice(0, pos + 1))), scoreOne(c, text(e.turns))];
      checked++;
      if (!isDeepStrictEqual(JSON.parse(JSON.stringify(mine)), theirs[c.checkpoint_id])) {
        mismatches++;
        if (mismatches <= 5) console.log(`mismatch ${c.checkpoint_id}`);
      }
    }
  }
  const episodes = domains.reduce((n, d) => n + d.episodes.length, 0);
  console.log(`episodes ${episodes} checkpoints ${checked} mismatches ${mismatches}`);
  return mismatches === 0 ? 0 : 1;
}

process.exitCode = main();
