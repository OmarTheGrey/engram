// Development-time comparison of C4's two verdict sources on GateMem (PR #25
// review, P3-2; ADR 0031): GateMem's RAG-Policy gate and the plane's own read
// decision under the preset C5 enforces (core's evaluateRead), for the asker
// of every checkpoint over every turn item up to it. Prints counts only; the
// shares PR 4 reports come from a research script (rule 9), not from here.
//
//   node packages/runner/scripts/compare-c4-verdicts.ts .engram/upstream/gatemem/bench/data [preset]
import { gatemem } from "@engram/bench";
import { evaluateRead, loadPreset, type PresetName } from "@engram/core";
import { sequentialIds } from "../src/gatemem-probe.ts";

function main(): number {
  const [data, preset = "medium"] = process.argv.slice(2);
  if (!data) {
    console.error("usage: compare-c4-verdicts.ts <bench/data dir> [preset]");
    return 2;
  }
  const policy = loadPreset(preset as PresetName);
  const counts = { items: 0, agree: 0, rag_allows_engram_denies: 0, rag_denies_engram_allows: 0 };
  const leaks: Record<string, { leak_items: number; rag_allows: number; engram_allows: number }> =
    {};
  for (const d of gatemem.loadDataset(data)) {
    for (const c of d.checkpoints) {
      const e = d.episodes.find((x) => x.episode_id === c.episode_id);
      if (!e) throw new Error(`no episode for ${c.checkpoint_id}`);
      const mapped = gatemem.mapCheckpoint(e, c, sequentialIds());
      const gate = gatemem.ragPolicyGate(mapped.episode, mapped.turns, mapped.checkpoint);
      const kind = (leaks[c.query_type] ??= { leak_items: 0, rag_allows: 0, engram_allows: 0 });
      mapped.writes.forEach(({ item }, i) => {
        const rag = (gate[i] as gatemem.RagPolicyChunk).allowed;
        const engram = evaluateRead(policy, mapped.asker, item, mapped.at).admitted;
        counts.items++;
        if (rag === engram) counts.agree++;
        else if (rag) counts.rag_allows_engram_denies++;
        else counts.rag_denies_engram_allows++;
        // Hidden labels, read here only to count where the leak targets sit.
        const text = (mapped.turns[i] as gatemem.Turn).text;
        if ((c.leak_targets ?? []).some((p) => gatemem.patternHits(text, p))) {
          kind.leak_items++;
          if (rag) kind.rag_allows++;
          if (engram) kind.engram_allows++;
        }
      });
    }
  }
  console.log(JSON.stringify({ preset, ...counts, leak_items_by_query_type: leaks }, null, 2));
  return 0;
}

process.exitCode = main();
