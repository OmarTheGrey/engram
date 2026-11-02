// One-off port check of GateMem's RAG-Policy gate on the full dataset (ADR
// 0031), development time only: the port's audit of every checkpoint at the
// pin against what upstream's own PolicyRAGAgent recorded.
//
//   python -I packages/bench/scripts/upstream-rag-policy-golden.py --upstream <dir> \
//       --data <dir>/bench/data --out .engram/bench/rag-policy-full.json
//   node packages/bench/scripts/check-rag-policy-upstream.ts <dir>/bench/data .engram/bench/rag-policy-full.json
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { loadDataset } from "../src/gatemem/load.ts";
import { type RagPolicyAudit, ragPolicyAudit } from "../src/gatemem/rag-policy.ts";

function main(): number {
  const [data, goldenPath] = process.argv.slice(2);
  if (!data || !goldenPath) {
    console.error("usage: check-rag-policy-upstream.ts <bench/data dir> <golden.json>");
    return 2;
  }
  const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
    rows: (RagPolicyAudit & { hidden_fields_inert: boolean })[];
  };
  const theirs = new Map(golden.rows.map((r) => [r.checkpoint_id, r]));
  let checked = 0;
  let mismatches = 0;
  let allowed = 0;
  let chunks = 0;
  const inert = golden.rows.filter((r) => r.hidden_fields_inert).length;
  for (const d of loadDataset(data)) {
    for (const c of d.checkpoints) {
      const e = d.episodes.find((x) => x.episode_id === c.episode_id);
      if (!e) throw new Error(`no episode for ${c.checkpoint_id}`);
      const mine = ragPolicyAudit(e, c);
      const row = theirs.get(c.checkpoint_id);
      checked++;
      allowed += mine.allowed.length;
      chunks += mine.chunks;
      const { hidden_fields_inert: _inert, ...expected } = row ?? ({} as never);
      if (!row || !isDeepStrictEqual(mine, expected)) {
        mismatches++;
        if (mismatches <= 5) console.log(`mismatch ${c.checkpoint_id}`);
      }
    }
  }
  console.log(
    `checkpoints ${checked} (golden ${golden.rows.length}) mismatches ${mismatches}; upstream's gate unmoved by hidden fields on ${inert}; chunks ${chunks}, allowed ${allowed}`,
  );
  return mismatches === 0 && checked === golden.rows.length ? 0 : 1;
}

process.exitCode = main();
