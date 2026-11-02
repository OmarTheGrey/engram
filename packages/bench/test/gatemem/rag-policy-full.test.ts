// The RAG-Policy port on GateMem's pinned full set (PR #25 review, P3-5):
// every one of the 2,218 checkpoints, against the per-checkpoint hashes
// upstream's own PolicyRAGAgent gave (upstream-rag-policy-full.json, written
// by packages/bench/scripts/upstream-rag-policy-golden.py --hashes). The
// fixture's 20 checkpoints miss branches of upstream's tables (a mutation
// letting the billing role see every topic passed them); the full set covers
// every branch the released data takes. It needs the pinned data in
// .engram/upstream/gatemem/bench/data, which `make bench BENCH=gatemem DRY=1`
// fetches; without it the test is skipped and says why.
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "@engram/core";
import { describe, expect, test } from "vitest";
import { loadDataset } from "../../src/gatemem/load.ts";
import { checkGateMemData } from "../../src/gatemem/pinned.ts";
import { ragPolicyAudit } from "../../src/gatemem/rag-policy.ts";
import { readJson } from "./fixture.ts";

const DATA = fileURLToPath(
  new URL("../../../../.engram/upstream/gatemem/bench/data", import.meta.url),
);
const present = checkGateMemData(DATA).set === "full";
const golden = readJson<{ hidden_fields_inert: number; checkpoints: Record<string, string> }>(
  "upstream-rag-policy-full.json",
);
const hash16 = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16);

describe("GateMem's RAG-Policy gate, ported, on the pinned full set", () => {
  test("the compact golden covers 2,218 checkpoints, and upstream's gate ignored every hidden field on all of them", () => {
    expect(Object.keys(golden.checkpoints)).toHaveLength(2218);
    expect(golden.hidden_fields_inert).toBe(2218);
  });

  test.skipIf(!present)(
    `every checkpoint matches upstream${present ? "" : ` (skipped: ${DATA} does not hold the pinned full set; make bench BENCH=gatemem DRY=1 fetches it)`}`,
    () => {
      const mismatches: string[] = [];
      let checked = 0;
      for (const d of loadDataset(DATA)) {
        for (const c of d.checkpoints) {
          const e = d.episodes.find((x) => x.episode_id === c.episode_id);
          if (!e) throw new Error(`no episode for ${c.checkpoint_id}`);
          checked++;
          if (hash16(ragPolicyAudit(e, c)) !== golden.checkpoints[c.checkpoint_id])
            mismatches.push(c.checkpoint_id);
        }
      }
      expect(checked).toBe(2218);
      expect(mismatches.slice(0, 5)).toEqual([]);
    },
    600_000,
  );
});
