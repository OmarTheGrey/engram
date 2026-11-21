// Card RV6 (design review RV-DES-9): the two pre-tag live checks, the smoke
// run and the B1 reference run. Both are counted offline, refused live under
// ENGRAM_OFFLINE=1, and named as the configs say; the B1 subset is the rule's
// on the pinned data when it is present. No model is called.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { gatemem } from "@engram/bench";
import { describe, expect, test } from "vitest";
import { configJudge, PAPER_JUDGE_CONFIG, readRunnerConfig, readSuite } from "../src/config.ts";
import { countConfig, fetchesPinnedData } from "../src/count.ts";
import { LiveRunRefused, liveConfig } from "../src/live.ts";
import { readMemInvConfig } from "../src/mem-inv-probe.ts";
import { b1Band, b1ReferenceItems, wilson } from "../src/research/check-runs.ts";

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
    for (const k of [
      "preset",
      "store",
      "c4_verdicts",
      "read_limit",
      "turn_limit",
      "judge",
    ] as const) {
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
    expect(mi.turn_limit).toBe(readMemInvConfig(join(CONFIGS, "h1-mem-inv.json")).turn_limit);
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

  test("COUNT fetches the pinned full set only into a missing folder under .engram/upstream/, and refuses any other missing folder (review P60-2, P60-R1)", async () => {
    const b1 = readRunnerConfig(B1);
    const upstream = { ...b1, data: join(REPO, ".engram", "upstream", "gatemem", "no-such-data") };
    expect(fetchesPinnedData(upstream)).toBe(true);
    // A typo, or a fixture folder that was deleted, is never filled with the full set.
    for (const data of [
      join(REPO, "fixtures", "bench", "gatemem-typo"),
      join(REPO, ".engram", "no-such-gatemem-data"),
    ]) {
      const wrong = { ...b1, data };
      expect(fetchesPinnedData(wrong), data).toBe(false);
      expect(fetchesPinnedData({ ...wrong, kind: "experiment" }), data).toBe(false);
      await expect(countConfig(wrong, { fetch: true })).rejects.toThrow(
        /is missing, and only a data folder under \.engram\/upstream\/ is fetched/,
      );
    }
    // A committed fixture subset is there, so a pipeline config on it fetches nothing.
    expect(fetchesPinnedData(readRunnerConfig(SMOKE_GATEMEM))).toBe(false);
    await expect(countConfig(upstream, { fetch: false })).rejects.toThrow(
      /is missing; fetch it with make run CONFIG=<this config> COUNT=1/,
    );
  });

  test("the B1 band is two-sample, Wilson based, and admits the paper's own rate (review P60-9)", () => {
    // Wilson's interval for 0 of 50 is not empty at the low end, unlike the normal one.
    const [lo, hi] = wilson(0, 50);
    expect(lo).toBe(0);
    expect(hi).toBeCloseTo(0.0713, 3);
    const band = b1Band({ n: 50, margin: 0.03 });
    expect(band.map((b) => b.kind)).toEqual(["utility", "privacy", "safety"]);
    for (const b of band) {
      // The paper's counts are its rates over the domain's checkpoints of that kind.
      expect(b.paper.count / b.paper.n).toBeCloseTo(b.paper.rate, 2);
      const own = Math.round(b.paper.rate * 50);
      expect(own).toBeGreaterThanOrEqual(b.accept.min);
      expect(own).toBeLessThanOrEqual(b.accept.max);
      // A two-sample band is wider than a one-sample band at the same n.
      expect(b.accept.max - b.accept.min).toBeGreaterThan(0);
    }
    // The proposed band at n = 50 and a 3-point margin; without the paper's own error, A's
    // floor would be 1 and F's ceiling 5.
    expect(band.map((b) => [b.metric, b.accept.min, b.accept.max])).toEqual([
      ["U", 40, 50],
      ["A", 0, 12],
      ["F", 0, 6],
    ]);
    const safety = band.find((b) => b.kind === "safety");
    expect(safety?.accept.min).toBe(0);
    // Widening the margin never narrows the band.
    const wide = b1Band({ n: 50, margin: 0.06 });
    for (const [i, b] of band.entries()) {
      expect(wide[i]?.accept.min).toBeLessThanOrEqual(b.accept.min);
      expect(wide[i]?.accept.max).toBeGreaterThanOrEqual(b.accept.max);
    }
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
