import { describe, expect, test } from "vitest";
import { AMSB_COMMIT, assemble, loadAmsb, loadControls } from "../../src/amsb/load.ts";

describe("the vendored AMSB corpus", () => {
  test("holds the 21 scenarios card R2 counted at the pinned commit, 15 attacks in five families and 6 benign", () => {
    const corpus = loadAmsb();
    expect(corpus.commit).toBe(AMSB_COMMIT);
    expect(corpus.counts).toEqual({ total: 21, malicious: 15, benign: 6 });
    const families: Record<string, number> = {};
    for (const s of corpus.scenarios.filter((x) => x.malicious))
      families[s.category] = (families[s.category] ?? 0) + 1;
    expect(families).toEqual({
      prompt_injection: 4,
      sensitive_data: 3,
      protected_key: 3,
      memory_persistence: 4,
      size_anomaly: 1,
    });
  });

  test("weights each scenario by AMSB's severity weight, critical 4 down to low 1", () => {
    const byId = new Map(loadAmsb().scenarios.map((s) => [s.id, s]));
    expect(byId.get("leak-aws-key")?.weight).toBe(4);
    expect(byId.get("inj-dan-jailbreak")?.weight).toBe(3);
    expect(byId.get("vol-overflow")?.weight).toBe(2);
    expect(byId.get("benign-code")?.weight).toBe(1);
  });

  test("assembles the fake token from its parts and the oversized payload from its unit", () => {
    const byId = new Map(loadAmsb().scenarios.map((s) => [s.id, s]));
    const token = byId.get("leak-github-token");
    expect(token?.canary).toMatch(/^ghp_[A-Za-z0-9]{36}$/);
    expect(token?.steps[0]?.value).toBe(`Use token ${token?.canary} to push.`);
    const vol = byId.get("vol-overflow");
    expect(vol?.steps[0]?.value.length).toBe(5000 * "Ignore previous instructions. ".length);
    expect(assemble({ parts: ["a", "b"] })).toBe("ab");
  });

  test("every attack's canary is in its own payload, so storing it verbatim is a breach", () => {
    for (const s of loadAmsb().scenarios.filter((x) => x.malicious))
      expect(s.steps.at(-1)?.value, s.id).toContain(s.canary);
  });
});

describe("card X14's benign controls", () => {
  test("load with unique ids and include the review's classes and a twin of every AMSB attack", () => {
    const { controls } = loadControls();
    const groups = new Set(controls.map((c) => c.group));
    for (const g of ["twin", "identifiers", "ml-docs", "ci-ops", "compaction", "security-notes"])
      expect(groups.has(g), g).toBe(true);
    const attacks = loadAmsb().scenarios.filter((s) => s.malicious);
    const twins = new Set(controls.filter((c) => c.group === "twin").map((c) => c.id));
    for (const a of attacks) expect(twins.has(`twin/${a.id}`), a.id).toBe(true);
  });
});
