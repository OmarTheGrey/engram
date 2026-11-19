// Card RV6 (design review RV-DES-9): the two pre-tag live checks, the smoke
// run and the B1 reference run. Both are counted offline, refused live under
// ENGRAM_OFFLINE=1, and named as the configs say; the B1 subset is the rule's
// on the pinned data when it is present. No model is called.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { gatemem } from "@engram/bench";
import { describe, expect, test } from "vitest";
import { configJudge, PAPER_JUDGE_CONFIG, readRunnerConfig, readSuite } from "../src/config.ts";
import { countConfig } from "../src/count.ts";
import { LiveRunRefused, liveConfig } from "../src/live.ts";
import { readMemInvConfig } from "../src/mem-inv-probe.ts";
import { b1ReferenceItems } from "../src/research/check-runs.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const CONFIGS = join(REPO, "research/configs");
const SMOKE = join(CONFIGS, "smoke-h1.json");
const SMOKE_GATEMEM = join(CONFIGS, "smoke-h1-gatemem.json");
const SMOKE_MEM_INV = join(CONFIGS, "smoke-h1-mem-inv.json");
const B1 = join(CONFIGS, "b1-gatemem-reference.json");
const FULL = join(REPO, ".engram/upstream/gatemem/bench/data");

describe("the smoke run: a handful of fixture items, C1 to C5, both arms, with the judge", () => {
  test("its members are pipeline configs on H1's store, preset and read limit, never an experiment", async () => {
    expect(readSuite(SMOKE).members).toEqual([SMOKE_GATEMEM, SMOKE_MEM_INV]);
    const gm = readRunnerConfig(SMOKE_GATEMEM);
    const h1 = readRunnerConfig(join(CONFIGS, "h1-gatemem.json"));
    expect(gm.kind).toBe("pipeline");
    expect(gm.conditions).toEqual(["C1", "C2", "C3", "C4", "C5"]);
    for (const k of ["preset", "store", "c4_verdicts", "read_limit", "judge"] as const) {
      expect(gm[k], k).toEqual(h1[k]);
    }
    expect(configJudge(gm)).toEqual(PAPER_JUDGE_CONFIG);
    const count = await countConfig(gm);
    expect(count.sessions).toBe(30);
    expect(count.item_kinds).toEqual({ "access control": 2, "active forgetting": 2, utility: 2 });
    expect(count.judge).toEqual({ model: PAPER_JUDGE_CONFIG.model, calls_min: 30, calls_max: 90 });

    const mi = readMemInvConfig(SMOKE_MEM_INV);
    expect(mi.kind).toBe("pipeline");
    expect(mi.store).toBe("mem0");
    const miCount = await countConfig(mi);
    expect(miCount.sessions).toBe(20);
    expect(Object.keys(miCount.item_kinds)).toHaveLength(5);
  });

  test("a live run of either is refused offline", () => {
    for (const config of [readRunnerConfig(SMOKE_GATEMEM), readMemInvConfig(SMOKE_MEM_INV)]) {
      expect(() =>
        liveConfig(config, {
          model: "openrouter/openai/gpt-5.6-terra",
          repo: REPO,
          env: { ENGRAM_OFFLINE: "1" },
        }),
      ).toThrow(LiveRunRefused);
    }
  });
});

describe("the B1 reference run: GateMem's long-context agent on a Medical subset", () => {
  test("C1 only, on the paper's backbone and judge, refused offline", () => {
    const b1 = readRunnerConfig(B1);
    expect(b1.kind).toBe("pipeline");
    expect(b1.conditions).toEqual(["C1"]);
    expect(b1.model).toBe("openrouter/openai/gpt-5.4");
    expect(configJudge(b1)).toEqual(PAPER_JUDGE_CONFIG);
    expect(b1.items).toHaveLength(150);
    expect(() =>
      liveConfig(b1, { model: b1.model, repo: REPO, env: { ENGRAM_OFFLINE: "1" } }),
    ).toThrow(LiveRunRefused);
  });

  test("the subset rule: per kind, k checkpoints spread evenly over the domain's, in the data's order", () => {
    const domains = gatemem.loadDataset(join(REPO, "fixtures/bench/gatemem"));
    const one = b1ReferenceItems(domains, "medical", 1);
    expect(one.available).toEqual({ utility: 2, privacy: 2, safety: 1 });
    // The middle of each kind's list: floor(0.5 * n).
    expect(one.items).toEqual([
      "med_episode_rewrite_en_012_new_hiv_deleted_harbor_light_line_ckpt_07",
      "med_episode_rewrite_en_012_new_hiv_deleted_harbor_light_line_ckpt_15",
      "med_episode_rewrite_en_012_new_hiv_deleted_harbor_light_line_ckpt_25",
    ]);
    // A domain with fewer checkpoints of a kind than asked is refused, not padded.
    expect(() => b1ReferenceItems(domains, "medical", 2)).toThrow(/1 safety checkpoints/);
  });

  test.skipIf(!existsSync(join(FULL, "medical", "checkpoints.jsonl")))(
    "on the pinned full set the config lists exactly the rule's 150 checkpoints",
    () => {
      const subset = b1ReferenceItems(gatemem.loadDataset(FULL), "medical", 50);
      expect(readRunnerConfig(B1).items).toEqual(subset.items);
      expect(subset.available).toEqual({ utility: 210, privacy: 192, safety: 177 });
    },
  );
});
